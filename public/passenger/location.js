(function(){
var button=document.getElementById('verifyLocation'),status=document.getElementById('locationStatus'),form=document.getElementById('authForm');
if(!button||!status||!form)return;
function message(t,type){status.textContent=t;status.className='location-status '+(type||'');}
function unlock(station,distance){
 try{sessionStorage.setItem('cc_passenger_location_verified','1');}catch(e){}
 form.classList.remove('location-locked');
 Array.prototype.forEach.call(form.querySelectorAll('input,button'),function(el){el.disabled=false;});
 button.textContent='Location verified';button.disabled=true;
 message('Railway station verified: '+station+' ('+distance+' m away). You can now sign in or create your account.','success');
}
function fail(t){message(t,'error');button.disabled=false;button.textContent='Try location again';}
function getPosition(options){return new Promise(function(resolve,reject){navigator.geolocation.getCurrentPosition(resolve,reject,options);});}
async function locate(){
 try{return await getPosition({enableHighAccuracy:true,timeout:12000,maximumAge:0});}
 catch(first){
  if(first&&first.code===1)throw first;
  message('Trying the device location service…');
  return await getPosition({enableHighAccuracy:false,timeout:15000,maximumAge:60000});
 }
}
async function verify(){
 if(!navigator.geolocation){fail('This browser does not support location. Open this page in Chrome and allow location access.');return;}
 button.disabled=true;button.textContent='Checking location…';
 message('Getting your current GPS location. Allow the location prompt and keep this page open.');
 try{
  var pos=await locate(),lat=pos.coords.latitude,lon=pos.coords.longitude;
  message('Checking railway stations within 500 metres…');
  var controller=new AbortController(),timer=setTimeout(function(){controller.abort();},12000);
  var response;
  try{response=await fetch('/api/nearby-railway?lat='+encodeURIComponent(lat)+'&lon='+encodeURIComponent(lon)+'&radius=500',{cache:'no-store',signal:controller.signal,headers:{Accept:'application/json'}});}
  finally{clearTimeout(timer);}
  var data=await response.json().catch(function(){return {};});
  if(!response.ok){
   fail(data.error||'Railway station search is temporarily unavailable. Please try again.');
   return;
  }
  if(data.verified&&Array.isArray(data.stations)&&data.stations.length){
   unlock(data.stations[0].name,data.stations[0].distance_m);
   return;
  }
  fail('No mapped railway station was found within 500 metres of your GPS location. If you are beside a station, its map record may be missing; please retry in a moment.');
 }catch(error){
  if(error&&typeof error.code==='number'){
   if(error.code===1){fail('Location permission was denied. In Chrome, click the icon beside the website address, set Location to Allow, then try again.');return;}
   if(error.code===2){fail('Your device could not determine your location. Turn on Windows Location services and try again near a window or outdoors.');return;}
   if(error.code===3){fail('GPS timed out. Turn on device Location services and try again.');return;}
  }
  fail(error&&error.name==='AbortError'?'Railway station search timed out. Please try again.':(error&&error.message?error.message:'Could not verify your nearby railway station. Please try again.'));
 }
}
form.classList.add('location-locked');
Array.prototype.forEach.call(form.querySelectorAll('input,button'),function(el){el.disabled=true;});
button.addEventListener('click',verify);
})();