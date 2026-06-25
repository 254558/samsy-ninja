class c{constructor(t={}){this.host=t.host||"localhost",this.port=t.port||9998,this.autoReconnect=t.autoReconnect!==!1,this.reconnectDelay=t.reconnectDelay||1e3,this.maxReconnectAttempts=t.maxReconnectAttempts||10,this.websocket=null,this.isConnected=!1,this.reconnectAttempts=0,this.reconnectTimer=null,this.onButtonPress=null,this.onButtonRelease=null,this.onConnect=null,this.onDisconnect=null,this.onError=null,this.currentState={GB_A:!1,GB_B:!1,GB_RIGHT:!1,GB_LEFT:!1,GB_UP:!1,GB_DOWN:!1,GB_SELECT:!1,GB_START:!1},this.previousState={...this.currentState},this.debugUI=null,this.debugButtons={}}createDebugUI(){this.debugUI=document.createElement("div"),this.debugUI.style.cssText=`
      position: fixed;
      top: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 15px;
      border-radius: 8px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      min-width: 200px;
      border: 1px solid #333;
    `;const t=document.createElement("div");t.textContent="GameBoy Controller Debug",t.style.cssText=`
      font-weight: bold;
      margin-bottom: 10px;
      color: #00ff00;
      text-align: center;
    `,this.debugUI.appendChild(t),this.connectionStatus=document.createElement("div"),this.connectionStatus.textContent="Status: Disconnected",this.connectionStatus.style.cssText=`
      margin-bottom: 10px;
      color: #ff4444;
    `,this.debugUI.appendChild(this.connectionStatus);const e=document.createElement("div");e.style.cssText=`
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 5px;
      margin-top: 10px;
    `,[["","GB_UP",""],["GB_LEFT","","GB_RIGHT"],["","GB_DOWN",""],["GB_SELECT","GB_START",""],["GB_B","GB_A",""]].forEach(s=>{s.forEach(o=>{const n=document.createElement("div");o?(n.textContent=o.replace("GB_",""),n.style.cssText=`
            padding: 8px;
            text-align: center;
            border: 1px solid #666;
            border-radius: 4px;
            background: #222;
            transition: all 0.2s ease;
            font-size: 10px;
          `,this.debugButtons[o]=n):n.style.cssText=`
            padding: 8px;
            visibility: hidden;
          `,e.appendChild(n)})}),this.debugUI.appendChild(e),this.statsDiv=document.createElement("div"),this.statsDiv.style.cssText=`
      margin-top: 10px;
      font-size: 10px;
      color: #aaa;
    `,this.debugUI.appendChild(this.statsDiv),document.body.appendChild(this.debugUI)}updateDebugUI(){}connect(){if(this.websocket&&this.websocket.readyState===WebSocket.OPEN)return;const t=`ws://${this.host}:${this.port}`;try{this.websocket=new WebSocket(t),this.setupEventListeners()}catch(e){this.onError&&this.onError(e),this.handleReconnect()}}disconnect(){this.autoReconnect=!1,this.reconnectTimer&&(clearTimeout(this.reconnectTimer),this.reconnectTimer=null),this.websocket&&(this.websocket.close(),this.websocket=null),Object.keys(this.currentState).forEach(t=>{this.currentState[t]=!1}),this.isConnected=!1,this.reconnectAttempts=0}setupEventListeners(){this.websocket&&(this.websocket.onopen=t=>{this.isConnected=!0,this.reconnectAttempts=0,this.onConnect&&this.onConnect(t)},this.websocket.onmessage=t=>{try{const e=JSON.parse(t.data);this.handleButtonData(e)}catch(e){this.onError&&this.onError(e)}},this.websocket.onclose=t=>{this.isConnected=!1,this.onDisconnect&&this.onDisconnect(t),this.handleReconnect()},this.websocket.onerror=t=>{this.onError&&this.onError(t)})}handleButtonData(t){this.previousState={...this.currentState},this.currentState={...t};const e=[],r=[];Object.keys(this.currentState).forEach(s=>{const o=this.previousState[s],n=this.currentState[s];!o&&n?e.push(s):o&&!n&&r.push(s)}),e.length>0&&this.onButtonPress&&this.onButtonPress(this.currentState,e),r.length>0&&this.onButtonRelease&&this.onButtonRelease(this.currentState,r)}handleReconnect(){this.autoReconnect&&(this.reconnectAttempts>=this.maxReconnectAttempts||(this.reconnectAttempts++,this.reconnectTimer=setTimeout(()=>{this.connect()},this.reconnectDelay)))}getButtonState(){return{...this.currentState}}isButtonPressed(t){return this.currentState[t]||!1}isConnectedToServer(){return this.isConnected}setOnButtonPress(t){this.onButtonPress=t}setOnButtonRelease(t){this.onButtonRelease=t}setOnConnect(t){this.onConnect=t}setOnDisconnect(t){this.onDisconnect=t}setOnError(t){this.onError=t}destroy(){this.disconnect()}}export{c as default};
