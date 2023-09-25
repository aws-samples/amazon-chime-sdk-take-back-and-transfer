/* eslint-disable import/no-extraneous-dependencies */
import { Stack, Duration } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { CfnEIP } from 'aws-cdk-lib/aws-ec2';
import { ServicePrincipal, Role, ManagedPolicy } from 'aws-cdk-lib/aws-iam';
import { Architecture, Runtime, Function, Code } from 'aws-cdk-lib/aws-lambda';
import {
  ChimePhoneNumber,
  PhoneProductType,
  PhoneNumberType,
  ChimeSipMediaApp,
  ChimeVoiceConnector,
  ChimeSipRule,
  TriggerType,
  PhoneCountry,
  Protocol,
} from 'cdk-amazon-chime-resources';
import { Construct } from 'constructs';

interface ChimeResourcesProps {
  logLevel: string;
  integrationTable: Table;
  asteriskEip: CfnEIP;
}

export class AmazonChimeSDKVoiceResources extends Construct {
  public voiceConnector: ChimeVoiceConnector;
  public smaPSTNPhoneNumber: ChimePhoneNumber;
  public smaPhoneNumbers: string[];
  public voiceConnectorPhoneNumber: ChimePhoneNumber;
  public sipMediaApp: ChimeSipMediaApp;
  public smaHandler: Function;

  constructor(scope: Construct, id: string, props: ChimeResourcesProps) {
    super(scope, id);

    this.voiceConnector = new ChimeVoiceConnector(this, 'pstnVoiceConnector', {
      termination: {
        terminationCidrs: [`${props.asteriskEip.ref}/32`],
        callingRegions: ['US'],
      },
      origination: [
        {
          host: props.asteriskEip.ref,
          port: 5060,
          protocol: Protocol.UDP,
          priority: 1,
          weight: 1,
        },
      ],
      encryption: false,
      loggingConfiguration: {
        enableMediaMetricLogs: true,
        enableSIPLogs: true,
      },
    });

    this.voiceConnectorPhoneNumber = new ChimePhoneNumber(
      this,
      'voiceConnectorPhoneNumber',
      {
        phoneProductType: PhoneProductType.VC,
        phoneCountry: PhoneCountry.US,
        phoneNumberType: PhoneNumberType.TOLLFREE,
        phoneNumberTollFreePrefix: 855,
      },
    );

    this.voiceConnectorPhoneNumber.associateWithVoiceConnector(
      this.voiceConnector,
    );

    this.smaPhoneNumbers = [];
    for (let i = 0; i < 3; i++) {
      const smaPhoneNumber = new ChimePhoneNumber(this, `smaPhoneNumber${i}`, {
        phoneProductType: PhoneProductType.SMA,
        phoneCountry: PhoneCountry.US,
        phoneNumberType: PhoneNumberType.TOLLFREE,
        phoneNumberTollFreePrefix: 855,
      });
      smaPhoneNumber.node.addDependency(this.voiceConnectorPhoneNumber);
      this.smaPhoneNumbers.push(smaPhoneNumber.phoneNumber);
    }

    this.smaPSTNPhoneNumber = new ChimePhoneNumber(this, 'smaPSTNPhoneNumber', {
      phoneProductType: PhoneProductType.SMA,
      phoneCountry: PhoneCountry.US,
      phoneNumberType: PhoneNumberType.TOLLFREE,
      phoneNumberTollFreePrefix: 855,
    });

    this.smaPSTNPhoneNumber.node.addDependency(this.voiceConnectorPhoneNumber);

    const smaHandlerRole = new Role(this, 'smaHandlerRole', {
      assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole',
        ),
      ],
    });

    this.smaHandler = new Function(this, 'smaHandler', {
      code: Code.fromAsset('src/resources/smaHandler'),
      handler: 'index.handler',
      environment: {
        LOG_LEVEL: props.logLevel,
        INTEGRATION_TABLE: props.integrationTable.tableName,
      },
      role: smaHandlerRole,
      runtime: Runtime.PYTHON_3_11,
      architecture: Architecture.ARM_64,
      timeout: Duration.minutes(15),
    });

    props.integrationTable.grantReadWriteData(this.smaHandler);

    this.sipMediaApp = new ChimeSipMediaApp(this, 'sipMediaApp', {
      region: Stack.of(this).region,
      endpoint: this.smaHandler.functionArn,
    });

    new ChimeSipRule(this, 'sipRule', {
      triggerType: TriggerType.TO_PHONE_NUMBER,
      triggerValue: this.smaPSTNPhoneNumber.phoneNumber,
      targetApplications: [
        {
          region: Stack.of(this).region,
          priority: 1,
          sipMediaApplicationId: this.sipMediaApp.sipMediaAppId,
        },
      ],
    });
  }
}
