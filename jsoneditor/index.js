(function(n,v,e,f,m){"use strict";var y=()=>f.before("dispatch",e.FluxDispatcher,l=>{if(n.isEnabled){const a=l[0];if(!a||a.type!=="MESSAGE_UPDATE"||a.otherPluginBypass)return;const r=a.message?.id||a.id;if(s.has(r)){const{path:i,value:t}=s.get(r),u={...a.message};return g(u,i,t),a.message=u,l}}});const{FormRow:d,FormSection:o,FormDivider:E}=m.Forms,{ScrollView:R,Text:D,View:N}=m.General,S=`{
  "id": "1492630605379145768",
  "content": "example text",
  "author": {
    "username": "User",
    "globalName": "Display Name",
    "avatarDecorationData": { "asset": "asset_id" }
  },
  "reactions": [{ 
    "emoji": { "name": "\u{1F62D}" }, 
    "count": 1 
  }],
  "flags": 0,
  "nick": "Server Nickname"
}`;function F(){return e.React.createElement(R,{style:{flex:1,padding:10}},e.React.createElement(o,{title:"Active Overrides"},s.size===0?e.React.createElement(d,{label:"No active edits",subLabel:"Use /edit <id> <path> <value>"}):Array.from(s.entries()).map(([l,a])=>e.React.createElement(d,{key:l,label:`ID: ${l}`,subLabel:`${a.path} \u2794 ${a.value}`})),s.size>0&&e.React.createElement(d,{label:"Clear All Overrides",onPress:()=>s.clear()})),e.React.createElement(E,null),e.React.createElement(o,{title:"Path Examples"},e.React.createElement(d,{label:"Edit Text",subLabel:"path: content"}),e.React.createElement(d,{label:"Edit Username",subLabel:"path: author/username"}),e.React.createElement(d,{label:"Edit Flags",subLabel:"path: flags (e.g. 64 for ephemeral)"})),e.React.createElement(E,null),e.React.createElement(o,{title:"Message Structure Reference"},e.React.createElement(N,{style:{backgroundColor:"#1e1e1e",padding:10,borderRadius:8}},e.React.createElement(D,{style:{fontFamily:"monospace",color:"#d4d4d4",fontSize:11}},S))))}n.isEnabled=!1;const s=new Map,g=(l,a,r)=>{const i=a.split("/");let t=l;for(let p=0;p<i.length-1;p++){const b=i[p];b in t||(t[b]={}),t=t[b]}const u=i[i.length-1];let c=r;r==="true"?c=!0:r==="false"?c=!1:!isNaN(r)&&r.trim()!==""&&(c=Number(r)),t[u]=c};let h;var P={onLoad:()=>{h=y(),n.isEnabled=!0,v.commands.registerCommand({name:"edit",description:"Manually edit a message JSON body using paths (e.g. author/username)",options:[{name:"id",description:"Message ID",type:3,required:!0},{name:"path",description:"Path (e.g. author/globalName)",type:3,required:!0},{name:"value",description:"New value (string, int, or bool)",type:3,required:!0}],execute:l=>{const a=l.find(t=>t.name==="id").value,r=l.find(t=>t.name==="path").value,i=l.find(t=>t.name==="value").value;s.set(a,{path:r,value:i}),e.FluxDispatcher.dispatch({type:"MESSAGE_UPDATE",message:{id:a},otherPluginBypass:!1})}})},onUnload:()=>{n.isEnabled=!1,h?.()},settings:F};return n.default=P,n.manualOverrides=s,n.setDeepValue=g,Object.defineProperty(n,"__esModule",{value:!0}),n})({},vendetta,vendetta.metro.common,vendetta.patcher,vendetta.ui.components);
