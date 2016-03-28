var http = require('http'),
    fs = require('fs'),
    url = require('url'),
    crypto = require('crypto'),
    spawn = require('child_process').spawn,
    config = JSON.parse(fs.readFileSync('./config.json'))


http.createServer(function (req, res) {
    var method = req.method.toLowerCase(),
        pathname = url.parse(req.url).pathname
    if(method === 'post'){
        config.deploys.forEach(function(task){
            if(pathname === task.path){
                handlerPost(req,res)
                    .then(function(payload){
                        req.payload = payload
                        return handler(req,res,task)
                    },function(errMsg,code){
                        errorHandler(res,errMsg,code)
                    })
                    .then(function(output){
                        console.log(output)
                    },function(err){
                        console.error(err)
                    })
            }
        })
    }
    
    
}).listen(config.port)

var errorHandler = function(res,errMsg,errCode){
    var err = new Error(errMsg)
    res.writeHead(errCode, {'content-type': 'application/json'})
    res.end(JSON.stringify({
        code: errCode,
        msg: errMsg
    }))
}

var successHandler = function(res){
    res.writeHead(200, {'content-type': 'application/json'})
    res.end(JSON.stringify({
        code: 200
    }))
}

var handlerPost = function(req,res){
    return new Promise(function(resolve,reject){
        var chunk = [],
            len = 0
        req.on('data',function(data){
            chunk.push(data)
            len += data.length
        }).on('end',function(){
            req.rawData = Buffer.concat(chunk,len)
            var payload = req.rawData.toString()
            try{
                payload = JSON.parse(payload)
                resolve(payload)
            }catch(err){
                reject('invalid json',500)
            }
        })
    })
}

var handler = function(req,res,task) {
    var type = task.type.toLowerCase(),
        payload = req.payload,
        event
        
    if(type === 'bitbucket'){
        event = req.headers['x-event-key']

        if(!event){
            return errorHandler(res,'No X-Event-Key found on request',401)
        }
        
        event = event.replace('repo:','') 
        
        if (!payload || !payload.repository || !payload.repository.name) {
            return errorHandler(res,'received invalid data from ' + req.headers['host'] + ', returning 400',400)
        }  
    }
    
    if(type === 'github'){
        var sig = req.headers['x-hub-signature'],
            id = req.headers['x-github-delivery']
            
        event = req.headers['x-github-event']
            
        if (!sig) {
            return errorHandler(res,'No X-Hub-Signature found on request',401)
        }
        if (!event) {
            return errorHandler(res,'No X-Github-Event found on request',401)
        }
        if (!id) {
            return errorHandler(res,'No X-Github-Delivery found on request',401)
        }
        
        if (sig !== signBlob(task.secret, req.rawData)) {
            return errorHandler(res,'X-Hub-Signature does not match blob signature',400)
        }
    }

    if(type === 'gitlab'){
        var xHeader = req.headers['x-gitlab-event']

        if(!xHeader){
            return errorHandler(res,'No X-Gitlab-Event found on request',401)
        }
        
        event = payload.object_kind
        
        if (!payload || !payload.repository || !payload.repository.name) {
            return errorHandler(res,'received invalid data from ' + req.headers['host'] + ', returning 400',400)
        }
    }

    var emitData = {
        event: event,
        payload: payload,
        protocol: req.protocol,
        host: req.headers['host'],
        url: req.url
    }
    
    successHandler(res)

    return run_cmd(task.action[event])
}

var run_cmd = function(args) {
  return new Promise(function(resolve,reject){
    var child = spawn('sh', [args]),resp = ''

    child.stdout.on('data', function(buffer) {
        resp += buffer.toString()
    })
    child.stdout.on('end', function() {
        resolve(resp)
    })
    child.stdout.on('error',function(){
        reject('error')
    })
  })
}

function signBlob (key, blob) {
  return 'sha1=' + crypto.createHmac('sha1', key).update(blob).digest('hex')
}