/* eslint-disable import/no-extraneous-dependencies */
import { Duration, Stack } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import {
  ManagedPolicy,
  PolicyDocument,
  PolicyStatement,
  Role,
  ServicePrincipal,
} from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Code, Function } from 'aws-cdk-lib/aws-lambda';
import {
  ChimeSipMediaApp,
  ChimeVoiceConnector,
  ChimePhoneNumber,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface RecordingLambdaResourcesProps {
  logLevel: string;
  integrationTable: Table;
  sipMediaApplication: ChimeSipMediaApp;
  voiceConnector: ChimeVoiceConnector;
  voiceConnectorPhoneNumber: ChimePhoneNumber;
}

export class LambdaResources extends Construct {
  public connectLambda: Function;

  constructor(
    scope: Construct,
    id: string,
    props: RecordingLambdaResourcesProps,
  ) {
    super(scope, id);

    const connectLambdaRole = new Role(this, 'connectLambdaRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      inlinePolicies: {
        ['chimePolicy']: new PolicyDocument({
          statements: [
            new PolicyStatement({
              resources: ['*'],
              actions: ['chime:UpdateSipMediaApplicationCall'],
            }),
          ],
        }),
      },
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    this.connectLambda = new Function(this, 'connectLambda', {
      code: Code.fromAsset('src/resources/connectLambda'),
      handler: 'index.handler',
      environment: {
        LOG_LEVEL: props.logLevel,
        INTEGRATION_TABLE: props.integrationTable.tableName,
        SIP_MEDIA_APPLICATION_ID: props.sipMediaApplication.sipMediaAppId,
        VOICE_CONNECTOR_PHONE_NUMBER:
          props.voiceConnectorPhoneNumber.phoneNumber,
        VOICE_CONNECTOR_ARN: `arn:aws:chime:${Stack.of(this).region}:${
          Stack.of(this).account
        }:vc/${props.voiceConnector.voiceConnectorId}`,
      },
      role: connectLambdaRole,
      runtime: Runtime.PYTHON_3_11,
      architecture: Architecture.ARM_64,
      timeout: Duration.minutes(15),
    });

    props.integrationTable.grantReadWriteData(this.connectLambda);
  }
}
