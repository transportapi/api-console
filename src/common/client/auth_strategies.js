(function() {
  'use strict';

  RAML.Client.AuthStrategies = {
    forScheme: function(scheme, credentials) {
      if (!scheme) {
        return RAML.Client.AuthStrategies.anonymous();
      }

      switch(scheme.type) {
      case 'Basic Authentication':
        return new RAML.Client.AuthStrategies.Basic(scheme, credentials);
      case 'OAuth 2.0':
        return new RAML.Client.AuthStrategies.Oauth2(scheme, credentials);
      case 'OAuth 1.0':
        return new RAML.Client.AuthStrategies.Oauth1(scheme, credentials);
      case 'Pass Through':
        return RAML.Client.AuthStrategies.anonymous();
      case 'x-custom':
        return RAML.Client.AuthStrategies.anonymous();
      case 'Anonymous':
        return RAML.Client.AuthStrategies.anonymous();
      default:
        throw new Error('Unknown authentication strategy: ' + scheme.type);
      }
    }
  };
})();
