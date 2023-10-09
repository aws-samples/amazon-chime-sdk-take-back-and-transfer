import {
  CustomResource,
  Duration,
  Stack,
  aws_connect as connect,
} from 'aws-cdk-lib';
import {
  ManagedPolicy,
  Role,
  ServicePrincipal,
  PolicyDocument,
  PolicyStatement,
} from 'aws-cdk-lib/aws-iam';
import { Function, Architecture, Runtime, Code } from 'aws-cdk-lib/aws-lambda';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { Provider } from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';
import { jsonToContactFlow } from './contactFlow';

export class ConnectInstanceResources extends Construct {
  public instance: connect.CfnInstance;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.instance = new connect.CfnInstance(this, 'Instance', {
      attributes: {
        inboundCalls: true,
        outboundCalls: false,
        autoResolveBestVoices: true,
        contactflowLogs: false,
        contactLens: false,
        earlyMedia: false,
        useCustomTtsVoices: false,
      },
      identityManagementType: 'CONNECT_MANAGED',
      instanceAlias: `take-back-and-transfer-${Stack.of(this).account}`,
    });
  }
}

interface ConnectPhoneResourcesProps {
  connectInstanceId: string;
}

export class ConnectPhoneResources extends Construct {
  public connectPhoneNumbers: string[];

  constructor(scope: Construct, id: string, props: ConnectPhoneResourcesProps) {
    super(scope, id);

    this.connectPhoneNumbers = [];

    for (let i = 0; i < 3; i++) {
      const connectPhoneNumber = new connect.CfnPhoneNumber(
        this,
        `connectPhoneNumber${i}`,
        {
          countryCode: 'US',
          type: 'DID',
          targetArn: `arn:aws:connect:${Stack.of(this).region}:${
            Stack.of(this).account
          }:instance/${props.connectInstanceId}`,
        },
      );
      this.connectPhoneNumbers.push(connectPhoneNumber.attrAddress);
    }
  }
}

interface ConnectContactFlowResourcesProps {
  connectLambda: Function;
  connectInstanceId: string;
  connectPhoneNumbers: string[];
}

export class ConnectContactFlowResources extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: ConnectContactFlowResourcesProps,
  ) {
    super(scope, id);

    new connect.CfnIntegrationAssociation(this, 'lambdaIntegration', {
      instanceId: `arn:aws:connect:${Stack.of(this).region}:${
        Stack.of(this).account
      }:instance/${props.connectInstanceId}`,
      integrationArn: props.connectLambda.functionArn,
      integrationType: 'LAMBDA_FUNCTION',
    });

    const contactFlow = new connect.CfnContactFlow(this, 'contactFlow', {
      content: jsonToContactFlow(props.connectLambda),
      instanceArn: `arn:aws:connect:${Stack.of(this).region}:${
        Stack.of(this).account
      }:instance/${props.connectInstanceId}`,
      type: 'CONTACT_FLOW',
      name: 'TakeBackAndTransferDemo',
    });

    const associateNumberCustomResourceRole = new Role(
      this,
      'associateNumberCustomResourceRole',
      {
        assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
        inlinePolicies: {
          ['connectPolicy']: new PolicyDocument({
            statements: [
              new PolicyStatement({
                resources: ['*'],
                actions: [
                  'connect:ListPhoneNumbersV2',
                  'connect:AssociatePhoneNumberContactFlow',
                  'connect:DisassociatePhoneNumberContactFlow',
                ],
              }),
            ],
          }),
        },
        managedPolicies: [
          ManagedPolicy.fromAwsManagedPolicyName(
            'service-role/AWSLambdaBasicExecutionRole',
          ),
        ],
      },
    );

    const associateNumberCustomResource = new Function(
      this,
      'associateNumberCustomResourceLambda',
      {
        code: Code.fromAsset('src/resources/associateNumberCustomResource'),
        handler: 'index.handler',
        runtime: Runtime.PYTHON_3_11,
        architecture: Architecture.ARM_64,
        timeout: Duration.minutes(1),
        role: associateNumberCustomResourceRole,
      },
    );

    const connectNumbersCustomResourceProvider = new Provider(
      this,
      'ConnectCustomResourceProvider',
      {
        onEventHandler: associateNumberCustomResource,
        logRetention: RetentionDays.ONE_WEEK,
      },
    );

    new CustomResource(this, 'ConnectCustomResource', {
      serviceToken: connectNumbersCustomResourceProvider.serviceToken,
      properties: {
        instanceId: props.connectInstanceId,
        contactFlowId: contactFlow.ref,
        phoneNumbers: props.connectPhoneNumbers,
      },
    });
  }
}
