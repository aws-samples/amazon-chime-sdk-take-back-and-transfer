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
    transaction_id = get_latest_transaction_id(sma_number, connect_number)
    if transaction_id is not None:
        logger.info("%s Calling SIP Media Application with transaction ID: %s", LOG_PREFIX, transaction_id)
        update_sip_media_application_call(transaction_id)
        status_code = 200
        message = f"Calling SIP Media Application with transaction ID: {transaction_id}."
    else:
        logger.info("%s No matching record found for calling number: %s and called number: %s", LOG_PREFIX, sma_number, connect_number)
        status_code = 503
        message = f"No matching record found for calling number {sma_number} and called number {connect_number}."

    response = {
        "statusCode": status_code,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({
            "message": message
        })
    }
    return response


def get_latest_transaction_id(sma_number, connect_number):
    logger.info("%s Getting latest transaction ID for calling number: %s and called number: %s", LOG_PREFIX, sma_number, connect_number)
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
        latest_item = response["Items"][0]
        transaction_id = latest_item["transaction_id"]["S"]
        return transaction_id
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
