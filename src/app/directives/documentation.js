(function () {
  'use strict';

  RAML.Directives.documentation = function() {
    return {
      restrict: 'E',
      templateUrl: 'directives/documentation.tpl.html',
      replace: true,
      controller: function($rootScope, $scope, $q, $http) {
        var defaultSchemaKey = Object.keys($scope.securitySchemes).sort()[0];
        var defaultSchema    = $scope.securitySchemes[defaultSchemaKey];

        $scope.schemaData = '';

        var fetchRefAndUpdate = function (schema, key, url) {
          var sharpIndex = url.indexOf('#'),
          path = null;
          if (sharpIndex !== -1) {
            path = url.substring(sharpIndex + 2);
          }

          return $http.get(url).then(function (response) {
            var json = response.data;

            if (json) {
              if (path !== null) {
                json = json[path];

                return json;
              }
            }
            return null;
          });
        };

        var constructUrl = function (rel, base) {
          if (rel.indexOf('doc') === 0) {
            rel = rel.substring(3);
          }
          if (rel.indexOf('/doc') === 0) {
            rel = rel.substring(4);
          }
          if (rel.indexOf('/') !== 0) {
            rel = '/' + rel;
          }

          return base + rel;
        };

        var getRefs = function (schema, base) {
          var promises = [];

          if (typeof(schema) === 'object') {
            var keys = Object.keys(schema);
            keys.forEach(function (key) {
              if (key === '$ref') {
                var refUrl = constructUrl(schema[key], base);
                var deferred = fetchRefAndUpdate(schema, key, refUrl).then(function (refData) {
                  if (refData !== null) {
                    delete schema[key];

                    for (key in refData) {
                      schema[key] = refData[key];
                    }
                  }
                });

                promises.push(deferred);
              } else if (typeof(schema[key]) === 'object') {
                promises.push(getRefs(schema[key], base));
              } else if (Object.prototype.toString.call(schema[key]) === '[object Array]') {
                var subPromises = [];
                schema[key].forEach(function(sub) {
                  subPromises.push(getRefs(sub, base));
                });
                promises.push($q.all(subPromises));
              }
            });
          } else if (Object.prototype.toString.call(schema) === '[object Array]') {
            var subPromises = [];
            schema.forEach(function(sub) {
              subPromises.push(getRefs(sub, base));
            });
            promises.push($q.all(subPromises));
          }

          return $q.all(promises);

        };

        var getSchemaRefs = function (schema, data) {
          var deferred = $q.defer();

          if (schema.indexOf('$ref') !== -1) {
            var schemaJson = JSON.parse(schema);
            getRefs(schemaJson, data.ramlUrl.substring(0, data.ramlUrl.indexOf('/raml'))).then(function () {
              deferred.resolve(JSON.stringify(schemaJson, null, 2));
            });
          } else {
            deferred.resolve(schema);
          }

          return deferred.promise;
        };

        var mergeAll = function (schema) {
          if (typeof(schema) === 'object') {
            var keys = Object.keys(schema);
            keys.forEach(function (key) {
              if (key === 'allOf') {
                if (schema.allOf.length > 0) {
                  var merged = schema.allOf[0],
                      i, ln = schema.allOf.length;
                  for (i = 1; i < ln; i++) {
                    merged = deepmerge(merged, schema.allOf[i]);
                  }

                  delete schema[key];
                  for (key in merged) {
                    schema[key] = merged[key];
                  }
                }
              } else if (typeof(schema[key]) === 'object') {
                mergeAll(schema[key]);
              } else if (Object.prototype.toString.call(schema[key]) === '[object Array]') {
                schema[key].forEach(function(sub) {
                  mergeAll(sub);
                });
              }
            });
          } else if (Object.prototype.toString.call(schema) === '[object Array]') {
            schema.forEach(function(sub) {
              mergeAll(sub);
            });
          }

        };

        var mergeAllOf = function (schema) {
          if (schema.indexOf('allOf') !== -1) {
            var schemaJson = JSON.parse(schema);
            mergeAll(schemaJson);

            return JSON.stringify(schemaJson, null, 2);
          }

          return schema;
        };

        $scope.markedOptions = RAML.Settings.marked;
        $scope.documentationSchemeSelected = defaultSchema;

        $scope.isSchemeSelected = function isSchemeSelected(scheme) {
          return scheme.id === $scope.documentationSchemeSelected.id;
        };

        $scope.selectDocumentationScheme = function selectDocumentationScheme(scheme) {
          $scope.documentationSchemeSelected = scheme;
        };

        $scope.schemaSettingsDocumentation = function schemaSettingsDocumentation(settings) {
          var doc = settings;

          if (typeof settings === 'object') {
            doc = settings.join(', ');
          }

          return doc;
        };

        $scope.unique = function (arr) {
          return arr.filter (function (v, i, a) { return a.indexOf (v) === i; });
        };

        $scope.currentStatusCode = '200';

        if ($scope.methodInfo.responseCodes && $scope.methodInfo.responseCodes.length > 0) {
          $scope.currentStatusCode = $scope.methodInfo.responseCodes[0];
        }

        function deepmerge(target, src) {
          var array = Array.isArray(src);
          var dst = array && [] || {};

          if (array) {
            target = target || [];
            dst = dst.concat(target);
            src.forEach(function(e, i) {
              if (typeof dst[i] === 'undefined') {
                dst[i] = e;
              } else if (typeof e === 'object') {
                dst[i] = deepmerge(target[i], e);
              } else {
                if (target.indexOf(e) === -1) {
                  dst.push(e);
                }
              }
            });
          } else {
            if (target && typeof target === 'object') {
              Object.keys(target).forEach(function (key) {
                dst[key] = target[key];
              });
            }
            Object.keys(src).forEach(function (key) {
              if (typeof src[key] !== 'object' || !src[key]) {
                dst[key] = src[key];
              }
              else {
                if (!target[key]) {
                  dst[key] = src[key];
                } else {
                  dst[key] = deepmerge(target[key], src[key]);
                }
              }
            });
          }

          return dst;
        }

        function beautify(body, contentType) {
          if(contentType.indexOf('json')) {
            body = vkbeautify.json(body, 2);
          }

          if(contentType.indexOf('xml')) {
            body = vkbeautify.xml(body, 2);
          }

          return body;
        }

        $scope.getBeatifiedExample = function (value) {
          var result = value;

          try {
            beautify(value, $scope.currentBodySelected);
          }
          catch (e) { }


          return result;
        };

        $scope.getColorCode = function (code) {
          return code[0] + 'xx';
        };

        $scope.showCodeDetails = function (code) {
          $scope.currentStatusCode = code;
        };

        $scope.isActiveCode = function (code) {
          return $scope.currentStatusCode === code;
        };

        $scope.showRequestDocumentation = true;
        $scope.toggleRequestDocumentation = function () {
          $scope.showRequestDocumentation = !$scope.showRequestDocumentation;
        };

        $scope.showResponseDocumentation = true;
        $scope.toggleResponseDocumentation = function () {
          $scope.showResponseDocumentation = !$scope.showResponseDocumentation;
        };

        $scope.parameterDocumentation = function (parameter) {
          var result = '';

          if (parameter) {
            if (parameter.required) {
              result += 'required, ';
            }

            if (parameter.enum) {
              var enumValues = $scope.unique(parameter.enum);

              if (enumValues.length > 1) {
                result += 'one of ';
              }

              result += '(' + enumValues.join(', ') + ')';

            } else {
              result += parameter.type || '';
            }

            if (parameter.pattern) {
              result += ' matching ' + parameter.pattern;
            }

            if (parameter.minLength && parameter.maxLength) {
              result += ', ' + parameter.minLength + '-' + parameter.maxLength + ' characters';
            } else if (parameter.minLength && !parameter.maxLength) {
              result += ', at least ' + parameter.minLength + ' characters';
            } else if (parameter.maxLength && !parameter.minLength) {
              result += ', at most ' + parameter.maxLength + ' characters';
            }


            if (parameter.minimum && parameter.maximum) {
              result += ' between ' + parameter.minimum + '-' + parameter.maximum;
            } else if (parameter.minimum && !parameter.maximum) {
              result += ' ≥ ' + parameter.minimum;
            } else if (parameter.maximum && !parameter.minimum) {
              result += ' ≤ ' + parameter.maximum;
            }

            if (parameter.repeat) {
              result += ', repeatable';
            }

            if (parameter['default']) {
              result += ', default: ' + parameter['default'];
            }
          }

          return result;
        };

        $scope.toggleTab = function ($event) {
          var $this        = jQuery($event.currentTarget);
          var $eachTab     = $this.parent().children('.raml-console-toggle-tab');
          var $panel       = $this.closest('.raml-console-resource-panel');
          var $eachContent = $panel.find('.raml-console-resource-panel-content');

          if (!$this.hasClass('raml-console-is-active')) {
            $eachTab.toggleClass('raml-console-is-active');
            $eachContent.toggleClass('raml-console-is-active');
          }
        };

        $scope.changeType = function ($event, type, code) {
          var $this        = jQuery($event.currentTarget);
          var $panel       = $this.closest('.raml-console-resource-body-heading');
          var $eachContent = $panel.find('span');

          $eachContent.removeClass('raml-console-is-active');
          $this.addClass('raml-console-is-active');

          $scope.responseInfo[code].currentType = type;
        };

        $scope.changeResourceBodyType = function ($event, type) {
          var $this        = jQuery($event.currentTarget);
          var $panel       = $this.closest('.raml-console-request-body-heading');
          var $eachContent = $panel.find('span');

          $eachContent.removeClass('raml-console-is-active');
          $this.addClass('raml-console-is-active');

          $scope.currentBodySelected = type;
        };

        $scope.getBodyId = function (bodyType) {
          return jQuery.trim(bodyType.toString().replace(/\W/g, ' ')).replace(/\s+/g, '_');
        };

        $scope.bodySelected = function (value) {
          return value === $scope.currentBodySelected;
        };

        $scope.$watch('currentBodySelected', function (value) {
          var $container = jQuery('.raml-console-request-body-heading');
          var $elements  = $container.find('span');

          $elements.removeClass('raml-console-is-active');
          $container.find('.raml-console-body-' + $scope.getBodyId(value)).addClass('raml-console-is-active');

          var data = $scope.responseInfo[200];
          if (data && data.currentType) {
            data = data[data.currentType];

            getSchemaRefs(data.schema, $rootScope).then(function (s) {
              $scope.schemaData = mergeAllOf(s);
            });
          }
        });

        $scope.showSchema = function ($event) {
          var $this   = jQuery($event.currentTarget);
          var $panel  = $this.closest('.raml-console-schema-container');
          var $schema = $panel.find('.raml-console-resource-pre-toggle');

          $this.toggleClass('raml-console-is-active');

          if (!$schema.hasClass('raml-console-is-active')) {
            $this.text('Hide Schema');
            $schema
              .addClass('raml-console-is-active')
              .velocity('slideDown');
          } else {
            $this.text('Show Schema');
            $schema
              .removeClass('raml-console-is-active')
              .velocity('slideUp');
          }
        };
      }
    };
  };

  angular.module('RAML.Directives')
    .directive('documentation', RAML.Directives.documentation);
})();
