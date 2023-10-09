import { Function } from 'aws-cdk-lib/aws-lambda';

export const jsonToContactFlow = (lambdaFunction: Function) => {
  return JSON.stringify({
    Version: '2019-10-30',
    StartAction: '93b3c694-3f9a-46f9-b53d-1fa4187f4d03',
    Metadata: {
      entryPointPosition: { x: 40, y: 40 },
      ActionMetadata: {
        '93b3c694-3f9a-46f9-b53d-1fa4187f4d03': {
          position: { x: 162.4, y: 101.6 },
        },
        '03a772b9-711c-4063-b71f-108b030e5174': {
          position: { x: 399.2, y: 100 },
        },
        'GetData': {
          position: { x: 640.8, y: 101.6 },
          isFriendlyName: true,
          parameters: {
            LambdaFunctionARN: {
              displayName: lambdaFunction.functionArn,
            },
          },
          dynamicMetadata: { Purpose: false },
        },
        'd87f251a-2ac4-4204-8d85-c5c684c820a1': {
          position: { x: 880, y: 99.2 },
          parameters: {
            Attributes: { OriginalCallingNumber: { useDynamic: true } },
          },
          dynamicParams: ['OriginalCallingNumber'],
        },
        'PlayOriginalCallingNumber': {
          position: { x: 1120.8, y: 100 },
          isFriendlyName: true,
        },
        'TransferCall': {
          position: { x: 1361.6, y: 98.4 },
          isFriendlyName: true,
          parameters: {
            LambdaFunctionARN: {
              displayName: lambdaFunction.functionArn,
            },
            LambdaInvocationAttributes: {
              CalledNumber: { useDynamic: true },
              CallingNumber: { useDynamic: true },
            },
          },
          dynamicMetadata: {
            CalledNumber: true,
            CallingNumber: true,
            Purpose: false,
          },
        },
        '90c241fa-4bd0-4def-84ce-9163792ae0b0': {
          position: { x: 1840.8, y: 359.2 },
        },
      },
      Annotations: [],
      name: 'TakeBackAndTransferDemo',
      description: '',
      type: 'contactFlow',
      status: 'saved',
      hash: {},
    },
    Actions: [
      {
        Parameters: { FlowLoggingBehavior: 'Enabled' },
        Identifier: '93b3c694-3f9a-46f9-b53d-1fa4187f4d03',
        Type: 'UpdateFlowLoggingBehavior',
        Transitions: { NextAction: '03a772b9-711c-4063-b71f-108b030e5174' },
      },
      {
        Parameters: {
          Text: 'Thank you for calling a Connect number through Amazon Chime SDK.',
        },
        Identifier: '03a772b9-711c-4063-b71f-108b030e5174',
        Type: 'MessageParticipant',
        Transitions: {
          NextAction: 'GetData',
          Errors: [
            {
              NextAction: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
              ErrorType: 'NoMatchingError',
            },
          ],
        },
      },
      {
        Parameters: {
          LambdaFunctionARN: lambdaFunction.functionArn,
          InvocationTimeLimitSeconds: '3',
          LambdaInvocationAttributes: {
            CalledNumber: '$.SystemEndpoint.Address',
            CallingNumber: '$.CustomerEndpoint.Address',
            Purpose: 'GetData',
          },
          ResponseValidation: { ResponseType: 'JSON' },
        },
        Identifier: 'GetData',
        Type: 'InvokeLambdaFunction',
        Transitions: {
          NextAction: 'd87f251a-2ac4-4204-8d85-c5c684c820a1',
          Errors: [
            {
              NextAction: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
              ErrorType: 'NoMatchingError',
            },
          ],
        },
      },
      {
        Parameters: {
          Attributes: {
            OriginalCallingNumber: '$.External.original_calling_number',
          },
          TargetContact: 'Current',
        },
        Identifier: 'd87f251a-2ac4-4204-8d85-c5c684c820a1',
        Type: 'UpdateContactAttributes',
        Transitions: {
          NextAction: 'PlayOriginalCallingNumber',
          Errors: [
            {
              NextAction: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
              ErrorType: 'NoMatchingError',
            },
          ],
        },
      },
      {
        Parameters: {
          SSML: "Your original calling number is <say-as interpret-as='telephone'>$.Attributes.OriginalCallingNumber</say-as>",
        },
        Identifier: 'PlayOriginalCallingNumber',
        Type: 'MessageParticipant',
        Transitions: {
          NextAction: 'TransferCall',
          Errors: [
            {
              NextAction: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
              ErrorType: 'NoMatchingError',
            },
          ],
        },
      },
      {
        Parameters: {
          LambdaFunctionARN: lambdaFunction.functionArn,
          InvocationTimeLimitSeconds: '3',
          LambdaInvocationAttributes: {
            CalledNumber: '$.SystemEndpoint.Address',
            CallingNumber: '$.CustomerEndpoint.Address',
            Purpose: 'TransferCall',
          },
          ResponseValidation: { ResponseType: 'JSON' },
        },
        Identifier: 'TransferCall',
        Type: 'InvokeLambdaFunction',
        Transitions: {
          NextAction: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
          Errors: [
            {
              NextAction: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
              ErrorType: 'NoMatchingError',
            },
          ],
        },
      },
      {
        Parameters: {},
        Identifier: '90c241fa-4bd0-4def-84ce-9163792ae0b0',
        Type: 'DisconnectParticipant',
        Transitions: {},
      },
    ],
  });
};
