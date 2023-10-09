/* eslint-disable import/no-extraneous-dependencies */
import { App, Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { config } from 'dotenv';
import {
  LambdaResources,
  VPCResources,
  DistributionResources,
  AmazonChimeSDKVoiceResources,
  ServerResources,
  DatabaseResources,
  DatabaseInitialization,
  CloudWatchResources,
  CognitoResources,
  EnvValidator,
  ConnectContactFlowResources,
  ConnectInstanceResources,
  ConnectPhoneResources,
} from '.';

config();

export interface AmazonChimeSDKTakeBackAndTransferProps extends StackProps {
  logLevel: string;
  connectNumbers: string;
  sshPubKey: string;
  allowedDomain?: string;
  connectInstanceId?: string;
}
export class AmazonChimeSDKTakBackAndTransfer extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKTakeBackAndTransferProps,
  ) {
    super(scope, id, props);

    EnvValidator(props);

    const vpcResources = new VPCResources(this, 'VPCResources');

    const distributionResources = new DistributionResources(
      this,
      'DistributionResources',
      {
        applicationLoadBalancer: vpcResources.applicationLoadBalancer,
      },
    );

    const cognitoResources = new CognitoResources(this, 'Cognito', {
      allowedDomain: props.allowedDomain || '',
    });

    const databaseResources = new DatabaseResources(this, 'DatabaseResources');

    const amazonChimeSDKVoiceResources = new AmazonChimeSDKVoiceResources(
      this,
      'voiceResources',
      {
        logLevel: props.logLevel,
        asteriskEip: vpcResources.serverEip,
        integrationTable: databaseResources.integrationTable,
      },
    );

    const lambdaResources = new LambdaResources(this, 'LambdaResources', {
      logLevel: props.logLevel,
      integrationTable: databaseResources.integrationTable,
      sipMediaApplication: amazonChimeSDKVoiceResources.sipMediaApp,
      voiceConnector: amazonChimeSDKVoiceResources.voiceConnector,
      voiceConnectorPhoneNumber:
        amazonChimeSDKVoiceResources.voiceConnectorPhoneNumber,
    });

    const serverResources = new ServerResources(this, 'Server', {
      serverEip: vpcResources.serverEip,
      voiceConnector: amazonChimeSDKVoiceResources.voiceConnector,
      phoneNumber: amazonChimeSDKVoiceResources.voiceConnectorPhoneNumber,
      vpc: vpcResources.vpc,
      voiceSecurityGroup: vpcResources.voiceSecurityGroup,
      albSecurityGroup: vpcResources.albSecurityGroup,
      sshSecurityGroup: vpcResources.sshSecurityGroup,
      logLevel: props.logLevel,
      sshPubKey: props.sshPubKey,
      applicationLoadBalancer: vpcResources.applicationLoadBalancer,
      distribution: distributionResources.distribution,
      userPool: cognitoResources.userPool,
      userPoolClient: cognitoResources.userPoolClient,
      userPoolRegion: cognitoResources.userPoolRegion,
      identityPool: cognitoResources.identityPool,
    });

    let connectNumbers: string[] = [];
    let connectInstanceId: string = '';

    if (!props.connectInstanceId) {
      const connectInstance = new ConnectInstanceResources(
        this,
        'ConnectInstanceResources',
      );
      connectInstanceId = connectInstance.instance.attrId;
    } else {
      connectInstanceId = props.connectInstanceId;
    }

    if (!props.connectNumbers) {
      const newConnectNumbers = new ConnectPhoneResources(
        this,
        'newConnectNumbers',
        {
          connectInstanceId: connectInstanceId,
        },
      );
      connectNumbers = newConnectNumbers.connectPhoneNumbers;
    } else {
      connectNumbers = props.connectNumbers.split(',');
    }

    new ConnectContactFlowResources(this, 'ConnectContactFlowResources', {
      connectLambda: lambdaResources.connectLambda,
      connectInstanceId: connectInstanceId,
      connectPhoneNumbers: connectNumbers,
    });

    new DatabaseInitialization(this, 'DatabaseInitialization', {
      integrationTable: databaseResources.integrationTable,
      smaPhoneNumbers: amazonChimeSDKVoiceResources.smaPhoneNumbers,
      connectPhoneNumbers: connectNumbers,
    });

    new CloudWatchResources(this, 'CloudWatchResources', {
      connectLambda: lambdaResources.connectLambda,
      smaHandler: amazonChimeSDKVoiceResources.smaHandler,
    });

    new CfnOutput(this, 'ssmCommand', {
      value: `aws ssm start-session --target ${serverResources.instanceId}`,
    });

    new CfnOutput(this, 'sshCommand', {
      value: `ssh ubuntu@${vpcResources.serverEip.ref}`,
    });

    new CfnOutput(this, 'EntryNumber', {
      value: amazonChimeSDKVoiceResources.smaPSTNPhoneNumber.phoneNumber,
    });

    new CfnOutput(this, 'DistributionURL', {
      value: distributionResources.distribution.distributionDomainName,
    });
  }
}

const app = new App();

const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: 'us-east-1',
};

const stackProps = {
  logLevel: process.env.LOG_LEVEL || 'INFO',
  connectNumbers: process.env.CONNECT_NUMBERS || '',
  sshPubKey: process.env.SSH_PUB_KEY || ' ',
  allowedDomain: process.env.ALLOWED_DOMAIN || '',
  connectInstanceId: process.env.CONNECT_INSTANCE_ID || '',
};

new AmazonChimeSDKTakBackAndTransfer(app, 'AmazonChimeSDKTakeBackAndTransfer', {
  ...stackProps,
  env: devEnv,
});

app.synth();
