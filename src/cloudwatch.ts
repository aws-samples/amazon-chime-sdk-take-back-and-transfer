import { Stack } from 'aws-cdk-lib';
import {
  Dashboard,
  LogQueryVisualizationType,
  LogQueryWidget,
} from 'aws-cdk-lib/aws-cloudwatch';
import { Function } from 'aws-cdk-lib/aws-lambda';
import { Construct } from 'constructs';

interface CloudWatchResourcesProps {
  connectLambda: Function;
  smaHandler: Function;
}

export class CloudWatchResources extends Construct {
  public dashboard: Dashboard;

  constructor(scope: Construct, id: string, props: CloudWatchResourcesProps) {
    super(scope, id);

    this.dashboard = new Dashboard(this, 'Dashboard', {
      dashboardName: 'AmazonChimeSDKConnectIntegration',
    });

    this.dashboard.addWidgets(
      new LogQueryWidget({
        title: 'AmazonChimeSDKConnectIntegration',
        logGroupNames: [
          props.smaHandler.logGroup.logGroupName,
          props.connectLambda.logGroup.logGroupName,
        ],
        width: 24,
        region: Stack.of(this).region,
        view: LogQueryVisualizationType.TABLE,
        queryLines: ['fields @message', 'sort @timestamp desc', 'limit 400'],
      }),
    );
  }
}
