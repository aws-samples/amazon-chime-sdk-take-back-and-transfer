import { RemovalPolicy } from 'aws-cdk-lib';
import {
  AttributeType,
  Table,
  TableEncryption,
  BillingMode,
  ProjectionType,
} from 'aws-cdk-lib/aws-dynamodb';
import {
  AwsCustomResource,
  PhysicalResourceId,
  AwsCustomResourcePolicy,
} from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export class DatabaseResources extends Construct {
  public integrationTable: Table;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.integrationTable = new Table(this, 'integrationTable', {
      partitionKey: {
        name: 'sma_number',
        type: AttributeType.STRING,
      },
      sortKey: { name: 'connect_number', type: AttributeType.STRING },
      removalPolicy: RemovalPolicy.DESTROY,
      encryption: TableEncryption.AWS_MANAGED,
      billingMode: BillingMode.PAY_PER_REQUEST,
    });

    this.integrationTable.addGlobalSecondaryIndex({
      indexName: 'in_use',
      partitionKey: { name: 'in_use', type: AttributeType.STRING },
      projectionType: ProjectionType.ALL,
    });
  }
}

interface DatabaseInitializationProps {
  integrationTable: Table;
  smaPhoneNumbers: string[];
  connectPhoneNumbers: string[];
}

export class DatabaseInitialization extends Construct {
  constructor(
    scope: Construct,
    id: string,
    props: DatabaseInitializationProps,
  ) {
    super(scope, id);

    const items = [];

    for (const smaNumber of props.smaPhoneNumbers) {
      for (const connectNumber of props.connectPhoneNumbers) {
        const item = {
          PutRequest: {
            Item: {
              sma_number: { S: smaNumber },
              connect_number: { S: connectNumber },
              in_use: { S: 'false' },
            },
          },
        };
        items.push(item);
      }
    }

    new AwsCustomResource(this, 'initTable', {
      installLatestAwsSdk: true,
      onCreate: {
        service: 'DynamoDB',
        action: 'batchWriteItem',
        parameters: {
          RequestItems: {
            [props.integrationTable.tableName]: items,
          },
        },
        physicalResourceId: PhysicalResourceId.of(
          props.integrationTable.tableName + '_initialization',
        ),
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: AwsCustomResourcePolicy.ANY_RESOURCE,
      }),
    });
  }
}
