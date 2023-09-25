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
} from '.';

config();

export interface AmazonChimeSDKTakeBackAndTransferProps extends StackProps {
  logLevel: string;
  connectNumbers: string;
  sshPubKey: string;
  allowedDomain?: string;
}
export class AmazonChimeSDKTakBackAndTransfer extends Stack {
  constructor(
    scope: Construct,
    id: string,
    props: AmazonChimeSDKTakeBackAndTransferProps,
  ) {
    super(scope, id, props);

    EnvValidator(props);

    const connectPhoneNumbers: string[] = props.connectNumbers.split(',');

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

    new DatabaseInitialization(this, 'DatabaseInitialization', {
      integrationTable: databaseResources.integrationTable,
      smaPhoneNumbers: amazonChimeSDKVoiceResources.smaPhoneNumbers,
      connectPhoneNumbers: connectPhoneNumbers,
    });

    const cloudwatchResources = new CloudWatchResources(
      this,
      'CloudWatchResources',
      {
        connectLambda: lambdaResources.connectLambda,
        smaHandler: amazonChimeSDKVoiceResources.smaHandler,
      },
    );

    new CfnOutput(this, 'ConnectLambda', {
      value: lambdaResources.connectLambda.functionArn,
    });
    new CfnOutput(this, 'ssmCommand', {
      value: `aws ssm start-session --target ${serverResources.instanceId}`,
    });

    new CfnOutput(this, 'sshCommand', {
      value: `ssh ubuntu@${vpcResources.serverEip.ref}`,
    });

    new CfnOutput(this, 'Dashboard', {
      value: cloudwatchResources.dashboard.dashboardName,
    });

    new CfnOutput(this, 'EntryNumber', {
      value: amazonChimeSDKVoiceResources.smaPSTNPhoneNumber.phoneNumber,
    });

    new CfnOutput(this, 'DistributionURL', {
      value: distributionResources.distribution.distributionDomainName,
    });

    new CfnOutput(this, 'SSHSecurityGroup', {
      value: vpcResources.sshSecurityGroup.securityGroupId,
    });

    new CfnOutput(this, 'addSSH', {
      value: `aws ec2 authorize-security-group-ingress --group-id ${vpcResources.sshSecurityGroup.securityGroupId} --protocol tcp --port 22 --cidr $( curl http://checkip.amazonaws.com )/32`,
    });
    new CfnOutput(this, 'revokeSSH', {
      value: `aws ec2 revoke-security-group-ingress --group-id ${vpcResources.sshSecurityGroup.securityGroupId} --protocol tcp --port 22 --cidr $( curl http://checkip.amazonaws.com )/32`,
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
};

new AmazonChimeSDKTakBackAndTransfer(app, 'AmazonChimeSDKTakeBackAndTransfer', {
  ...stackProps,
  env: devEnv,
});

app.synth();
