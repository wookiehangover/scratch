
/**
 * Module dependencies.
 */

var express   = require('./node_modules/express');
var fs        = require('fs');
var _         = require('underscore');
var connect   = require('connect');
var mime      = require('mime');

var app = module.exports = express.createServer();

var title = "scratch.";

var db = {
  path: '/public/files'
};

// Configuration

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

// Routes

function readDir(dir){
  var files = false;

  try {
    files = _.select( fs.readdirSync( dir ), function(f){
      return !( /^\.{1}/.test(f) );
    });


    files = _.map( files, function(f){
      var slug = f.replace(/\s+/g, '-');

      return { path: slug, name: f, uri: encodeURI(f) };
    });
  } catch(e){

  }

  return files;
}

app.get('/', function(req, res){
  var files = readDir( __dirname + db.path );

  res.render('index', {
    title: title + ' ' + db.path,
    files: files.sort(),
    path: ""
  });
});

app.get('/tree/*', function(req, res){

  var fullpath = __dirname + db.path +"/"+ req.params[0],

      files = readDir( fullpath ),

      name = req.params[0],

      type;

  if( /\.(?:avi|mkv)$/.test( name ) ){
    type = 'divx';
  }

  if( /\.(?:webm|ogg|mp4)$/.test( name ) ){
    type = 'video';
  }

  if( /\.(:?mp3)$/.test( name ) ){
    type = 'audio';
  }

  if( files.length ) {
    return res.render('index', {
      title: title + ' ' + db.path,
      files: files.sort(function(a,b){
        return ( a.name < b.name ) ? -1: 1;
      }),
      path: req.params[0] + "/"
    });
  }

  res.render('show', {
    title: title,
    name: name,
    path: db.path.replace(/\/public/, "") +'/'+ name,
    type: type,
    contentType:  mime.lookup( name )

  });
});



// Only listen on $ node app.js

if (!module.parent) {
  app.listen(3000);
  console.log("Express server listening on port %d", app.address().port);
}
