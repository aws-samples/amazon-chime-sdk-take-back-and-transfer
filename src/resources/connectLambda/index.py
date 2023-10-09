import os
import json
import logging
from datetime import datetime
import boto3

dynamodb = boto3.client('dynamodb')
chime_sdk = boto3.client('chime-sdk-voice')
logger = logging.getLogger()


try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

INTEGRATION_TABLE = os.environ['INTEGRATION_TABLE']
SIP_MEDIA_APPLICATION_ID = os.environ['SIP_MEDIA_APPLICATION_ID']
VOICE_CONNECTOR_PHONE_NUMBER = os.environ['VOICE_CONNECTOR_PHONE_NUMBER']
VOICE_CONNECTOR_ARN = os.environ['VOICE_CONNECTOR_ARN']


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'Connect Lambda: '
    logger.info("%s Event: %s", LOG_PREFIX, json.dumps(event, indent=2))
    sma_number = event['Details']['Parameters']['CallingNumber']
    connect_number = event['Details']['Parameters']['CalledNumber']
    purpose = event['Details']['Parameters']['Purpose']
    body = {}
    call_data = get_data(sma_number, connect_number)
    if purpose == 'GetData':
        logger.info('Getting Data')
        if call_data['original_calling_number']['S'] is not None:
            logger.info('%s Get Data returned original_calling_number: %s', LOG_PREFIX, call_data['original_calling_number']['S'])
            body['original_calling_number'] = call_data['original_calling_number']['S']
        else:
            logger.info("%s No matching record found for calling number: %s and called number: %s", LOG_PREFIX, sma_number, connect_number)
            body['message'] = f"No matching record found for calling number {sma_number} and called number {connect_number}."
    elif purpose == 'TransferCall':
        logger.info('Transferring Call')
        if call_data['transaction_id']['S'] is not None:
            logger.info("%s Calling SIP Media Application with transaction ID: %s", LOG_PREFIX, call_data['transaction_id']['S'])
            update_sip_media_application_call(call_data['transaction_id']['S'])
            body['message'] = f"Calling SIP Media Application with transaction ID: {call_data['transaction_id']['S']}."
        else:
            logger.info("%s No matching record found for calling number: %s and called number: %s", LOG_PREFIX, sma_number, connect_number)
            body['message'] = f"No matching record found for calling number {sma_number} and called number {connect_number}."
    response = body
    return response


def get_data(sma_number, connect_number):
    logger.info("%s Getting latest data for calling number: %s and called number: %s", LOG_PREFIX, sma_number, connect_number)
    response = dynamodb.query(
        TableName=INTEGRATION_TABLE,
        KeyConditionExpression="sma_number = :sma_number and connect_number = :connect_number",
        ExpressionAttributeValues={
            ":sma_number": {"S": sma_number},
            ":connect_number": {"S": connect_number}
        },
        Limit=1,
        ScanIndexForward=False
        )

    if response["Count"] > 0:
        item = response["Items"][0]
        logger.info("%s Table returned: %s", LOG_PREFIX, json.dumps(item))
        return item
    else:
        return None


def update_sip_media_application_call(transaction_id):
    arguments = {
        "TransferTarget": VOICE_CONNECTOR_PHONE_NUMBER,
        "TransferTargetArn": VOICE_CONNECTOR_ARN,
        "Transfer": "true",
    }
    response = chime_sdk.update_sip_media_application_call(
        SipMediaApplicationId=SIP_MEDIA_APPLICATION_ID,
        TransactionId=transaction_id,
        Arguments=arguments
    )
    return response
