import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

interface GitHubCognitoOpenidWrapperProps {
  githubClientId: string;
  githubClientSecretArn: string;
  /**
   * The Cognito domain base URL.
   */
  cognitoRedirectUri: string;
  githubApiUrl?: string;
  githubLoginUrl?: string;
}

export class GitHubCognitoOpenidWrapper extends Construct {
  readonly endpoint: string;

  constructor(
    scope: Construct,
    id: string,
    props: GitHubCognitoOpenidWrapperProps
  ) {
    super(scope, id);

    const githubAppClientSecret = secretsmanager.Secret.fromSecretAttributes(
      this,
      'githubAppClientSecret',
      {
        secretCompleteArn: props.githubClientSecretArn,
      }
    );
    const environment = {
      GITHUB_CLIENT_ID: props.githubClientId,
      GITHUB_CLIENT_SECRET: githubAppClientSecret.secretValue.unsafeUnwrap(),
      COGNITO_REDIRECT_URI: props.cognitoRedirectUri,
      GITHUB_API_URL: props.githubApiUrl ?? 'https://api.github.com',
      GITHUB_LOGIN_URL: props.githubLoginUrl ?? 'https://github.com',
    };
    const handlerCode = lambda.Code.fromAsset('./dist-lambda');
    const lambdaCommonProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      code: handlerCode,
      environment,
    };

    const openIdDiscovery = new lambda.Function(this, 'OpenIdDiscovery', {
      ...lambdaCommonProps,
      handler: 'openIdConfiguration.handler',
    });
    const authorize = new lambda.Function(this, 'Authorize', {
      ...lambdaCommonProps,
      handler: 'authorize.handler',
    });
    const token = new lambda.Function(this, 'Token', {
      ...lambdaCommonProps,
      handler: 'token.handler',
    });
    const userInfo = new lambda.Function(this, 'UserInfo', {
      ...lambdaCommonProps,
      handler: 'userinfo.handler',
    });
    const jwks = new lambda.Function(this, 'Jwks', {
      ...lambdaCommonProps,
      handler: 'jwks.handler',
    });

    const api = new apigateway.RestApi(this, 'OpenidApi', {
      restApiName: 'GitHub Cognito OpenID Wrapper API',
    });

    const wellKnownResource = api.root.addResource('.well-known');
    wellKnownResource
      .addResource('openid-configuration')
      .addMethod('GET', new apigateway.LambdaIntegration(openIdDiscovery));
    wellKnownResource
      .addResource('jwks.json')
      .addMethod('GET', new apigateway.LambdaIntegration(jwks));

    api.root
      .addResource('authorize')
      .addMethod('GET', new apigateway.LambdaIntegration(authorize));

    const tokenIntegration = new apigateway.LambdaIntegration(token);
    const tokenResource = api.root.addResource('token');
    tokenResource.addMethod('GET', tokenIntegration);
    tokenResource.addMethod('POST', tokenIntegration);

    const userInfoResource = api.root.addResource('userinfo');
    const userInfoIntegration = new apigateway.LambdaIntegration(userInfo);
    userInfoResource.addMethod('GET', userInfoIntegration);
    userInfoResource.addMethod('POST', userInfoIntegration);
    this.endpoint = api.url;
  }
}

const app = new cdk.App();
const stack = new cdk.Stack(app, 'GithubCognitoOpenidWrapperStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
const githubOpenidWrapper = new GitHubCognitoOpenidWrapper(
  stack,
  'GithubCognitoOpenidWrapper',
  {
    githubClientId: app.node.getContext('githubClientId'),
    githubClientSecretArn: app.node.getContext('githubClientSecretArn'),
    cognitoRedirectUri: app.node.getContext('cognitoRedirectUri'),
  }
);

new cdk.CfnOutput(stack, 'GithubOpenidEndpoint', {
  description: 'GitHub OpenID wrapper endpoint',
  value: githubOpenidWrapper.endpoint,
});

app.synth();
