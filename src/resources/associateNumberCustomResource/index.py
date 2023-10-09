import json
import boto3
import logging
from botocore.exceptions import ClientError

logger = logging.getLogger()

try:
    LOG_LEVEL = os.environ['LOG_LEVEL']
    if LOG_LEVEL not in ['INFO', 'DEBUG', 'WARN', 'ERROR']:
        LOG_LEVEL = 'INFO'
except BaseException:
    LOG_LEVEL = 'INFO'
logger.setLevel(LOG_LEVEL)

client = boto3.client('connect', region_name='us-east-1')


def handler(event, context):
    global LOG_PREFIX
    LOG_PREFIX = 'Connect Custom Resource Lambda: '
    logger.info("%s Event: %s", LOG_PREFIX, json.dumps(event, indent=2))

    request_type = event['RequestType']
    response = {
        "StackId": event['StackId'],
        "RequestId": event['RequestId'],
        "LogicalResourceId": event['LogicalResourceId'],
        "PhysicalResourceId": context.log_group_name
    }

    try:
        if request_type == 'Create' or request_type == 'Update':
            logger.info('%s Associating Phone Numbers', LOG_PREFIX)
            associate_phone_numbers(event['ResourceProperties'])
        elif request_type == 'Delete':
            logger.info('%s Disassociating Phone Numbers', LOG_PREFIX)
            disassociate_phone_numbers(event['ResourceProperties'])
    except ClientError as e:
        logger.error('%s Error: %s', LOG_PREFIX, e)
    logger.info('%s Response: %s', LOG_PREFIX, json.dumps(response, indent=2))
    return response


def associate_phone_numbers(properties):
    for phone_number in properties.get('phoneNumbers', []):
        phone_number_id = get_phone_number_id(phone_number)
        if phone_number_id:
            logger.info('%s phone_number_id found: %s', LOG_PREFIX, phone_number_id)
            response = client.associate_phone_number_contact_flow(
                PhoneNumberId=phone_number_id,
                InstanceId=properties['instanceId'],
                ContactFlowId=properties['contactFlowId']
            )
            logger.info('%s Association Response: %s', LOG_PREFIX, json.dumps(response, indent=2))
        else:
            logger.info('%s No phone_number_id found for %s', LOG_PREFIX, phone_number)


def disassociate_phone_numbers(properties):
    for phone_number in properties.get('phoneNumbers', []):
        phone_number_id = get_phone_number_id(phone_number)
        if phone_number_id:
            logger.info('%s phone_number_id found: %s', LOG_PREFIX, phone_number_id)
            response = client.disassociate_phone_number_contact_flow(
                PhoneNumberId=phone_number_id,
                InstanceId=properties['instanceId']
            )
            logger.info('%s Disassociation Response: %s', LOG_PREFIX, json.dumps(response, indent=2))


def get_phone_number_id(e164_number):
    response = client.list_phone_numbers_v2()
    logger.info('%s List Response: %s', LOG_PREFIX, json.dumps(response, indent=2))
    for number in response.get('ListPhoneNumbersSummaryList', []):
        if number['PhoneNumber'] == e164_number:
            return number['PhoneNumberId']
    return None
