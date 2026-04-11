(function(s,v,e,f,E){"use strict";var y=()=>f.before("dispatch",e.FluxDispatcher,l=>{if(!s.isEnabled)return;const t=l[0];if(!t||t.type!=="MESSAGE_UPDATE"||t.otherPluginBypass)return;const a=t.message?.id||t.id;if(a&&d.has(a)){const{path:i,value:r}=d.get(a),u=t.message||{id:a},n=JSON.parse(JSON.stringify(u));try{m(n,i,r),t.message=n}catch(o){console.error("[JSON Editor] Path set failed",o)}return l}});const{FormRow:c,FormSection:b,FormDivider:h}=E.Forms,{ScrollView:R,Text:D,View:N}=E.General,S=`{
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
}`;function F(){return e.React.createElement(R,{style:{flex:1,padding:10}},e.React.createElement(b,{title:"Active Overrides"},d.size===0?e.React.createElement(c,{label:"No active edits",subLabel:"Use /edit <id> <path> <value>"}):Array.from(d.entries()).map(([l,t])=>e.React.createElement(c,{key:l,label:`ID: ${l}`,subLabel:`${t.path} \u2794 ${t.value}`})),d.size>0&&e.React.createElement(c,{label:"Clear All Overrides",onPress:()=>d.clear()})),e.React.createElement(h,null),e.React.createElement(b,{title:"Path Examples"},e.React.createElement(c,{label:"Edit Text",subLabel:"path: content"}),e.React.createElement(c,{label:"Edit Username",subLabel:"path: author/username"}),e.React.createElement(c,{label:"Edit Flags",subLabel:"path: flags (e.g. 64 for ephemeral)"})),e.React.createElement(h,null),e.React.createElement(b,{title:"Message Structure Reference"},e.React.createElement(N,{style:{backgroundColor:"#1e1e1e",padding:10,borderRadius:8}},e.React.createElement(D,{style:{fontFamily:"monospace",color:"#d4d4d4",fontSize:11}},S))))}s.isEnabled=!1;const d=new Map,m=(l,t,a)=>{if(!l)return;const i=t.split("/");let r=l;for(let o=0;o<i.length-1;o++){const p=i[o];(!r[p]||typeof r[p]!="object")&&(r[p]={}),r=r[p]}const u=i[i.length-1];let n=a;a==="true"?n=!0:a==="false"?n=!1:!isNaN(a)&&a.trim()!==""&&(n=Number(a)),r[u]=n};let g;var O={onLoad:()=>{g=y(),s.isEnabled=!0,v.commands.registerCommand({name:"edit",description:"Manually edit a message JSON body",options:[{name:"id",description:"Message ID",type:3,required:!0},{name:"path",description:"Path (e.g. author/globalName)",type:3,required:!0},{name:"value",description:"New value",type:3,required:!0}],execute:l=>{const t=u=>l.find(n=>n.name===u)?.value,a=t("id"),i=t("path"),r=t("value");!a||!i||(d.set(a,{path:i,value:r}),e.FluxDispatcher.dispatch({type:"MESSAGE_UPDATE",message:{id:a},otherPluginBypass:!1}))}})},onUnload:()=>{s.isEnabled=!1,g?.()},settings:F};return s.default=O,s.manualOverrides=d,s.setDeepValue=m,Object.defineProperty(s,"__esModule",{value:!0}),s})({},vendetta,vendetta.metro.common,vendetta.patcher,vendetta.ui.components);
