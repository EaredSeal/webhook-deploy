# webhook-deploy

webhook service manager,compatible with github,gitlab and bitbucket

##How To Use

1. modify `config.json` into your own webhook config

    {
      "port": 8890, // listening port
      "deploys": [
          {
              "name": "uploader", // project name
              "path": "/deploy/uploader", // webhook url pathname,here bitbucket will send post request to <your ip>:8890/deploy/uploader while push event trigger
              "type": "bitbucket", // bitbucket,gitlab,github
              "secret": "<your github secret>", //only for github
              "action": {
                  "push": "/uploader.sh" //<eventKey>: <path to shell>
                  ... 
              }
          },{
            ... // more deploy config
          }
          
      ]
    }
  
2. use `pm2`,`forever` or `supervisor` to run `index.js` 

