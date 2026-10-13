export const access = 'public';
export const methods = ['GET'];
function distanceMeters(a,b,c,d){
  const rad=Math.PI/180,p1=a*rad,p2=c*rad,dp=(c-a)*rad,dl=(d-b)*rad;
  const q=Math.sin(dp/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2;
  return 6371000*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
export default async function(req,res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Access-Control-Allow-Methods','GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers','Content-Type');
  res.setHeader('Cache-Control','no-store');
  if(req.method==='OPTIONS')return res.status(204).send('');
  if(req.method!=='GET')return res.status(405).json({error:'Method not allowed.'});
  const lat=Number(req.query?.lat),lon=Number(req.query?.lon);
  const radius=500;
  if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)
    return res.status(400).json({error:'A valid GPS latitude and longitude are required.'});
  const latDelta=radius/111000;
  const lonDelta=radius/(111000*Math.max(0.2,Math.cos(lat*Math.PI/180)));
  const west=lon-lonDelta,east=lon+lonDelta,north=lat+latDelta,south=lat-latDelta;
  const url='https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=0&extratags=1&limit=40&bounded=1&viewbox='+[west,north,east,south].join(',')+'&q='+encodeURIComponent('railway station');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),9000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:'application/json','User-Agent':'CoachConnectPassenger/1.0 (railway proximity verification)'}});
    if(!response.ok)return res.status(503).json({verified:false,error:'The railway station search service is temporarily unavailable. Please retry.'});
    const data=await response.json();
    if(!Array.isArray(data))return res.status(503).json({verified:false,error:'The railway station search returned an invalid response.'});
    const stations=[];
    for(const item of data){
      const category=String(item.category||item.class||'').toLowerCase();
      const type=String(item.type||'').toLowerCase();
      if(category!=='railway'||!['station','halt','tram_stop'].includes(type))continue;
      const extra=item.extratags||{};
      const transport=String(extra.network||'')+' '+String(extra.operator||'')+' '+String(extra.station||'')+' '+String(extra.subway||'');
      if(extra.station==='subway'||extra.subway==='yes'||/metro/i.test(transport))continue;
      const stationLat=Number(item.lat),stationLon=Number(item.lon);
      if(!Number.isFinite(stationLat)||!Number.isFinite(stationLon))continue;
      const distance=distanceMeters(lat,lon,stationLat,stationLon);
      if(distance>radius)continue;
      stations.push({name:item.name||item.display_name?.split(',')[0]||'Railway station',distance_m:Math.round(distance),lat:stationLat,lon:stationLon,type});
    }
    stations.sort((a,b)=>a.distance_m-b.distance_m);
    return res.json({verified:stations.length>0,radius_m:radius,stations:stations.slice(0,10),source:'OpenStreetMap Nominatim'});
  }catch(error){
    return res.status(503).json({verified:false,error:'The railway station search service could not be reached. Please retry.'});
  }finally{clearTimeout(timer);}
}