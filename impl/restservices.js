var fetch = require('node-fetch');
// function to invoke bpel
exports.sh_facerecogprocess = function (inputParams) {
  var url = 'http://soa.wedoteam.io' + '/soa-infra/resources/default/SH_FaceRecogProcess/FaceRecogRestService';
  var message = {
      image: inputParams.image,
      demozone: inputParams.demozone
    };
  return fetch(url, {
    method: 'POST',
    headers: {'Content-Type' : 'application/json'},
    body: JSON.stringify(message)
  }).then(function(response) {
    return response.json();
  }).then(function(json){
    return json;
  }).catch(function(err){
    console.log(err);
  });
}
