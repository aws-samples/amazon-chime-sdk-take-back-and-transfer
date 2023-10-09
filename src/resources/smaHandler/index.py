import logging
import json
import os
import time
import random
import boto3
logger = logging.getLogger()
dynamodb = boto3.client('dynamodb')


try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)
INTEGRATION_TABLE = os.environ['INTEGRATION_TABLE']


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'SMA Handler: '

    logger.info('%s Event Received %s ', LOG_PREFIX, json.dumps(event, indent=2))
    event_type = event["InvocationEventType"]
    transaction_id = event['CallDetails']['TransactionId']

    if 'TransactionAttributes' in event['CallDetails']:
        transaction_attributes = event['CallDetails']['TransactionAttributes']
    else:
        transaction_attributes = {}

    actions = []

    if event_type == 'NEW_INBOUND_CALL':
        logger.info('%s NEW_INBOUND_CALL', LOG_PREFIX)
        dnis = update_integration_table(transaction_id=transaction_id, original_calling_number=event['CallDetails']['Participants'][0]['From'])
        transaction_attributes['sma_number'] = dnis['sma_number']
        transaction_attributes['connect_number'] = dnis['connect_number']
        transaction_attributes['original_calling_number'] = event['CallDetails']['Participants'][0]['From']
        transaction_attributes['active_call_to_connect'] = 'true'
        actions = [
            speak('We are currently in a SIP media application.  Transferring to Connect', event['CallDetails']['Participants'][0]['CallId']),
            call_and_bridge_connect(dnis['sma_number'], dnis['connect_number'])
        ]

    if event_type == 'RINGING':
        logger.info('%s RINGING', LOG_PREFIX)

    if event_type == 'CALL_ANSWERED':
        logger.info('%s CALL_ANSWERED', LOG_PREFIX)

    if event_type == 'ACTION_SUCCESSFUL' and event['ActionData']['Type'] == 'Hangup' and transaction_attributes.get('transfer', 'false') == 'true':
        logger.info('%s TRANSFER', LOG_PREFIX)
        target_number = transaction_attributes['target_number']
        target_arn = transaction_attributes['target_arn']
        sma_number = transaction_attributes['sma_number']
        original_calling_number = transaction_attributes['original_calling_number']
        actions = [
            speak('Please hold while we connect you', event['CallDetails']['Participants'][0]['CallId']),
            call_and_bridge_sip(sma_number, target_number, target_arn, original_calling_number)
        ]

    if event_type == 'HANGUP' and event['ActionData']['Parameters']['ParticipantTag'] == 'LEG-A':
        logger.info('%s HANGUP FROM LEG-A', LOG_PREFIX)
        if len(event['CallDetails']['Participants']) > 1:
            actions = [
                hangup(event['CallDetails']['Participants'][1]['CallId'])
            ]
        if transaction_attributes.get('active_call_to_connect', 'false') == 'true':
            logger.info('%s REMOVING CALL FROM INTEGRATION TABLE', LOG_PREFIX)
            transaction_attributes['active_call_to_connect'] = 'false'
            remove_call_from_integration_table(transaction_attributes['sma_number'], transaction_attributes['connect_number'])

    if event_type == 'HANGUP' and event['ActionData']['Parameters']['ParticipantTag'] == 'LEG-B' and transaction_attributes.get('transfer', 'false') == 'false':
        logger.info('%s HANGUP FROM LEG-B', LOG_PREFIX)
        if len(event['CallDetails']['Participants']) > 1:
            leg_a_participant = next((p for p in event['CallDetails']['Participants'] if p['ParticipantTag'] == 'LEG-A'), None)
            actions = [
                hangup(leg_a_participant['CallId'])
            ]

        if transaction_attributes.get('active_call_to_connect', 'false') == 'true':
            logger.info('%s REMOVING CALL FROM INTEGRATION TABLE', LOG_PREFIX)
            transaction_attributes['active_call_to_connect'] = 'false'
            remove_call_from_integration_table(transaction_attributes['sma_number'], transaction_attributes['connect_number'])

    if event_type == 'CALL_UPDATE_REQUESTED':
        logger.info('%s CALL_UPDATE_REQUESTED', LOG_PREFIX)
        transaction_attributes['target_number'] = event['ActionData']['Parameters']['Arguments']['TransferTarget']
        transaction_attributes['target_arn'] = event['ActionData']['Parameters']['Arguments']['TransferTargetArn']
        transaction_attributes['transfer'] = 'true'
        transaction_attributes['active_call_to_connect'] = 'false'
        logger.info('%s REMOVING CALL FROM INTEGRATION TABLE', LOG_PREFIX)
        remove_call_from_integration_table(transaction_attributes['sma_number'], transaction_attributes['connect_number'])
        actions = [
            hangup(event['CallDetails']['Participants'][1]['CallId']),
        ]

    response = {
        "SchemaVersion": "1.0",
        "Actions": actions,
        "TransactionAttributes": transaction_attributes
    }

    logger.info('%s Response %s ', LOG_PREFIX, json.dumps(response, indent=2))
    return response


def hangup(call_id):
    return {
            "Type": "Hangup",
            "Parameters": {"CallId": call_id}
        }


def call_and_bridge_connect(sma_number, target_number):
    return {
        "Type": "CallAndBridge",
        "Parameters": {
            "CallTimeoutSeconds": 30,
            "CallerIdNumber": sma_number,
            "Endpoints": [
                {
                    "BridgeEndpointType": "PSTN",
                    "Uri": target_number,
                }
            ],
        }
     }


def call_and_bridge_sip(sma_number, target_number, target_arn, original_calling_number):
    return {
        "Type": "CallAndBridge",
        "Parameters": {
            "CallTimeoutSeconds": 30,
            "CallerIdNumber": sma_number,
            "Endpoints": [
                {
                    "BridgeEndpointType": "AWS",
                    "Arn": target_arn,
                    "Uri": target_number,
                }
            ],
            "SipHeaders": {
                "X-Original-Calling-Number": original_calling_number
            }
        }
     }


def speak(text, call_id):
    return {
            "Type": "Speak",
            "Parameters": {
                "Text": text,
                "CallId": call_id,
                "Engine": "neural",
                "LanguageCode": "en-US",
                "TextType": "text",
                "VoiceId": "Joanna"
            }
        }


def update_integration_table(transaction_id, original_calling_number):
    current_timestamp = int(time.time())
    while True:
        response = dynamodb.query(
            TableName=INTEGRATION_TABLE,
            IndexName='in_use',
            KeyConditionExpression='in_use = :false',
            ExpressionAttributeValues={':false': {'S': 'false'}},
            Limit=1
        )
        logger.info('%s Integration Table Query Response %s', LOG_PREFIX, response)

        if 'Items' in response and len(response['Items']) > 0:
            sma_number = response['Items'][0]['sma_number']['S']
            connect_number = response['Items'][0]['connect_number']['S']
            logger.info('%s Integration Table Update Request %s', LOG_PREFIX, {'sma_number': sma_number, 'connect_number': connect_number})
            try:
                dynamodb.update_item(
                    TableName=INTEGRATION_TABLE,
                    Key={
                        'sma_number': {'S': sma_number},
                        'connect_number': {'S': connect_number}
                    },
                    UpdateExpression='SET \
                        transaction_id = :transaction_id, \
                        call_timestamp = :current_timestamp, \
                        in_use = :true, \
                        original_calling_number = :original_calling_number',
                    ConditionExpression='attribute_not_exists(in_use) OR in_use = :false',
                    ExpressionAttributeValues={
                        ':transaction_id': {'S': transaction_id},
                        ':original_calling_number': {'S': original_calling_number},
                        ':current_timestamp': {'N': str(current_timestamp)},
                        ':true': {'S': 'true'},
                        ':false': {'S': 'false'},
                    },
                )
                logger.info('%s Integration Table Updated', LOG_PREFIX)
                return {'sma_number': sma_number, 'connect_number': connect_number}
            except dynamodb.exceptions.ConditionalCheckFailedException:
                logger.info('%s Integration Table Update Failed. Retrying', LOG_PREFIX)
        else:
            raise ValueError('No available items found')


def remove_call_from_integration_table(sma_number, connect_number):
    logger.info('%s Integration Table Remove in_use %s', LOG_PREFIX, {'sma_number': sma_number, 'connect_number': connect_number})
    try:
        response = dynamodb.update_item(
            TableName=INTEGRATION_TABLE,
            Key={
                'sma_number': {'S': sma_number},
                'connect_number': {'S': connect_number}
            },
            UpdateExpression='SET in_use = :false',
            ExpressionAttributeValues={
                ':false': {'S': 'false'}
            }
        )
        logger.info('%s Integration Table Remove in_use Response %s', LOG_PREFIX, response)
        return True
    except dynamodb.exceptions.ClientError as error:
        print(f"Error updating item: {error}")
        return False
