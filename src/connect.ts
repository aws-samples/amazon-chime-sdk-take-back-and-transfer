import { Stack, aws_connect as connect } from 'aws-cdk-lib';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface ConnectResourcesProps {
  connectLambda: Function;
}

export class ConnectResources extends Construct {
  constructor(scope: Construct, id: string, props: ConnectResourcesProps) {
    super(scope, id);

    const instance = new connect.CfnInstance(this, 'Instance', {
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
