#!/usr/bin/env node
// TODO cannot find one shebang spec to work for both Linux and mobile Termux .
// TODO on mobile Termux shebang has to be patched manually at install .
// #!/data/data/com.termux/files/usr/bin/node
// https://raw.githubusercontent.com/hydeparkny/tech/master/voip.ms.api/voipms.js

// TODO install package dependencies especially for mobile Termux .
// TODO can point npm to a URL for a package.json on Github ?

"use strict";

/*
  the voip.ms web site has a user specified IP whitelist for this API .
  Main Menu -> SOAP and REST/JSON API
  only Cablevision/Optimum/Altice WAN IP 24.228.46.99 ,
  current as of 2017Feb09 , is listed there .
  
  HMMM , whitelist could be a problem when phone on a mobile IP ;
  need to identify IP of the outbound NAT gateway .
  I think nb4xubu1604:S14firewall has the Cricket/ATT outbound NAT IP .
  
  2017aug27 - remove hardcoded username/password so file can be on Github
  $HOME/.creds contains files named the hostnames of the enclosed credentials
*/

function doUrl(doUrlCmd,cb) {
// callback code stolen from Node.js http.get section
// have to use https instead of http in require
require('https').get(doUrlCmd, (res) => {
  const statusCode = res.statusCode;
  const contentType = res.headers['content-type'];

  let error;
  if (statusCode !== 200) {
    res.resume();
    cb(["",statusCode,""]);
  } 

  res.setEncoding('utf8');
  let rawData = '';
  res.on('data', (chunk) => rawData += chunk);
  res.on('end', () => {
  cb([rawData,statusCode,contentType]);
  });
}).on('error', (e) => {
  console.log(`Got error: ${e.message}`);
  cb([e,-1,""]);
});
}

function getCDR(cb) {
// accept a callback that is passed directly to doUrl .
// doUrl takes the callback to process the received data .
var dateEnd1 = Date.now();
var dateStart1 = dateEnd1 - 86400000; // 24 hours prior to now
var dateEnd2 = new Date(dateEnd1);
var dateStart2 = new Date(dateStart1);
// conver dates to format required by API query string
var dateEnd = dateEnd2.getFullYear()+"-"+
    ("0"+(1+dateEnd2.getMonth()).toString()).substr(-2,2)+"-"+
    ("0"+(dateEnd2.getDate()).toString()).substr(-2,2);
var dateStart = dateStart2.getFullYear()+"-"+
    ("0"+(1+dateStart2.getMonth()).toString()).substr(-2,2)+"-"+
    ("0"+(dateStart2.getDate()).toString()).substr(-2,2);
var voipmsApi="&method=getCDR"+"&date_from="+dateStart+"&date_to="+dateEnd+"&answered=1&timezone=-5"
var voipmsCmd=require('url').parse(voipmsURL+voipmsCreds+voipmsApi);
console.log("voipmsCmd",voipmsCmd);

doUrl(voipmsCmd,cb);
return;
}

function addBlockRule(blockPhone) {
// TODO not tested; just converted from Python to Node
// add a new caller ID filtering rule
 var voipmsApi="&method=setCallerIDFiltering"+"&callerid="+blockPhone+"&did="+ourPhone+"&routing=sys:hangup"+"&note=junk%20call%20api";
 var voipmsCmd=voipmsURL+voipmsCreds+voipmsApi;
 var blockRule=doUrl(voipmsCmd);
 console.log(blockRule);
 return(blockRule);
}

function getCreds(hostname) {
    var os = require('os');
    var fs = require('fs');
    var credsSubDir = "/.creds";
// TODO need to check that locating .creds works correctly on mobile device .
    var fileName = os.homedir()+credsSubDir+"/"+hostname;
//    var fileName = "junk";
    console.log("fileName",fileName);
    var data = fs.readFileSync(fileName, 'utf8');
    return(JSON.parse(data));
/*
// callback never gets called , even with bad filename
    fs.readFile(fileName, 'utf8', function (err, data) {
	console.log("readFile callback");
	if (err) {
	    throw err;
	    console.error("error",err.message);
	    process.exit(255);
	}
	else {
	    console.log("data",data);
	    return(data);
	}
    });
*/
    
}

// main Main MAIN
var creds=getCreds("voip.ms");
console.log("creds",creds);
var username = creds['username'];
var password = creds['password'];

// var ourPhone="8454714958";
// blocking rules default to "all" , in case another DID is added someday
var ourPhone="all";

var voipmsURL="https://voip.ms/api/v1/rest.php";
var voipmsCreds="?api_username="+username+"&api_password="+password;
var notes800url="http://800notes.com/Phone.aspx/";

// this barfs on the && no matter what I do
// TODO accept other end/start dates , not just default now/-24hrs
// TODO can Commander package help here ?
/*
 command line arguments :
  single 10 or 11 digit string - block that single number
  blockall - block all numbers returned by end/start date query
  TODO TBD - query end/start dates
*/ 
/*
if ((2==process.argv.length) && ((11==process.argv[1].length) || (10==process.argv[1].length))) {
    addBlockRule(process.argv[1]);
    process.exit(0);
}
*/

// default action with no arguments ; just list CDR data
// callback is passed 3-element array .
//   cb([rawData,statusCode,contentType]);
// if statusCode is -1 , rawData is an error object .
// rawData,contentType are null strings for HTTP statusCode other than 200 .
getCDR((cdrData) => { 
 switch (cdrData[1]) {
  case 200:
   var rawData=cdrData[0];
   if (rawData.trim().substr(0,1) != '{') {
    var cdrResults=JSON.parse(rawData);
   }
   else {
    console.log("getCDR=",cdrData);
   }
   break;
  case -1:
   console.log("horrible doUrl error",cdrData[0]);
   break;
  default:
   console.log("HTTP status",cdrData[1]);
 }
} );
// HUH what stops doUrl and getCDR returning here before doUrl receives all
// HUH the data and makes the callback ?  this is what went wrong in the
// HUH "connections" login code .
/*
// TODO this code lumps together unrelated things just to share the
// TODO "loop on CDR array" code to #1 list the CDR summary and 800 URL
// TODO #2 block all numbers in the CDR
function blockAll(cdrData) {
if cdrData[1]==200 and cdrData[0]["status"]!="no_cdr":
 a=cdrData[0]["cdr"]
 for i in a:
  blockPhone=i["callerid"].split()[1].strip('<>')
  print blockPhone," seconds=",i["seconds"]," ",notes800url+blockPhone
  if 2==len(sys.argv) and 0!=len(sys.argv[1]) and sys.argv[1]=="blockall" and i["description"]=="Inbound DID":
   # add a new caller ID filtering rule
   addBlockRule(blockPhone)
}   
*/

// get current block list
var voipmsApi="&method=getCallerIDFiltering"
var voipmsCmd=voipmsURL+voipmsCreds+voipmsApi

// check current block list for the new calling numbers .
// there should be no matches , else something is broken at voip.ms

// run the new calling numbers through the 800notes site .
// if the numbers have a history , go ahead and block them .

