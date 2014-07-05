var http = require('http');
var url = require('url');
var fs = require('fs');
var nodeStatic = require('node-static');
var net = require('net');
var _ = require('underscore')
var haproxy = require('haproxy-sock-handler');


module.exports = {
  config : {listen_ip: "127.0.0.1", listen_port: 7125 },
  init : function() {
      //
      // Create a node-static server instance to serve the './public' folder
      //
      var self = this;

      var file = new(nodeStatic.Server)('./public');

      var server = http.createServer(function(request, response) {

      var pathName = url.parse(request.url).pathname;

      var switchboard = [{
        regex: /^\/status$/,
        onget: function() {
          haproxy.showStat(function(data) {
            //console.log(_.keys(data));
            var output = JSON.stringify(data);
            response.writeHead(200, {
              "Content-Type": "text/json",
              "Content-Length": output.length,
              "Access-Control-Allow-Origin": "*"
            });
            response.end(output);
          });
        }
      }, {
        regex: /^\/(.+)\/sessions$/,
        onget: function(data) {
          haproxy.showSessions(function(data) {
            var output = JSON.stringify(data);
            response.writeHead(200, {
              "Content-Type": "text/json",
              "Content-Length": output.length,
              "Access-Control-Allow-Origin": "*"
            });
            response.end(output);
          });
        },
      }];

      var data = "";

      request.addListener('data', function(chunk) {
        data += chunk;
      });

      request.addListener('end', function() {

        if(request.method === "GET") {
          var found = false;
          var method = request.method;

          _.each(switchboard, function(elem) {
            if(elem.regex.test(pathName)) {
              found = true;
              if(method === "GET" && elem.onget) {
                elem.onget(data);
              } else if(method === "POST" && elem.onpost) {
                elem.onpost(data);
              } else {
                response.writehead(404);
                response.end("");
              }
            }
          });
          if(!found) {
            file.serve(request, response);
          }
        } else if(request.method === "POST") {
            var output = {}, obj;
            if (pathName.match(/^\/update\/?$/)) {
              //TODO: try catch here...
              obj = JSON.parse(data);
            } else if (pathName.match(/^\/(.+\/.+?)\/?$/)) {
              var myregexp = /^\/(.+\/.+?)\/?$/;
              var match = myregexp.exec(pathName);
              if (match != null && match.length > 1) {
                obj = {};
                //TODO: try catch here...
                var dta = JSON.parse(data);
                obj[match[1]] = dta;
              }
            }
            if (obj) {
              haproxy.updateBackends(obj,function(stats) {
                var outputString = JSON.stringify(stats);
                response.writeHead(200, {
                    "Content-Type": "text/json",
                    "Content-Length": outputString.length,
                    "Access-Control-Allow-Origin": "*"
                  });
                  response.end(outputString);
                });
            } else {
                response.writehead(404);
                response.end("");
            }
        }

      });
    });

    server.listen(self.config.listen_port,self.config.listen_ip);
  }

}


