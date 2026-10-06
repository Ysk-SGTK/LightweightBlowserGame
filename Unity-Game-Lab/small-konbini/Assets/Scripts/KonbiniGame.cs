using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

public class KonbiniGame : MonoBehaviour {
    [NonSerialized] public ShopModel model;
    public StoreView view;[NonSerialized] public StoreSimulation store;
    public readonly List<DayReport> history=new List<DayReport>();
    public string panel="";public int selectedShelf;float emit,feedbackUntil;string feedback="";GUIStyle text,small,title,button;Texture2D paper;bool styled;
    [DllImport("__Internal")] static extern void ShopSnapshot(string json);
    void Awake(){Application.targetFrameRate=60;Retry();}
    public void Retry(){model=new ShopModel(Environment.TickCount);store=new StoreSimulation(model,Environment.TickCount);history.Clear();panel="";selectedShelf=0;forecastKey="";cachedForecast=null;cachedSingle=null;store.spawnView=c=>view.Spawn(c);store.removeView=c=>Destroy(c.body);store.sold=amount=>{feedback="+"+Money(amount);feedbackUntil=Time.unscaledTime+1.1f;};view.Build(store);}
    string forecastKey="";ShopForecast cachedForecast,cachedSingle;
    public ShopForecast Prediction(){string key=model.weather+":"+model.staffCount+":"+model.OrderCost();for(int i=0;i<5;i++)key+=":"+model.stock[i]+":"+model.order[i]+":"+model.price[i];foreach(var s in store.shelves)key+=":"+s.slot+":"+s.product+":"+s.capacity;if(key!=forecastKey||cachedForecast==null){cachedForecast=ForecastCalculator.Calculate(store);cachedSingle=model.staffCount==2?ForecastCalculator.Calculate(store,1):cachedForecast;forecastKey=key;}return cachedForecast;}
    public bool Open(){if(model.state!="Morning"||model.OrderCost()>model.cash)return false;var f=Prediction();var single=cachedSingle;if(!store.Open())return false;model.report.forecast=f;model.report.singleStaffForecast=single;panel="";return true;}
    public void SetStaff(int count){if(model.state=="Morning"&&(count==1||count==2))model.staffCount=count;}
    public void Next(){model.Next();panel="";if(model.state=="Morning")store.elapsed=0;for(int i=0;i<5;i++)store.warehouse[i]=model.stock[i];view.Refresh(store,true);}
    void Update(){if(model.state=="Open"){store.Tick(Time.deltaTime);if(model.state=="Result")history.Add(model.report);}view.Refresh(store,model.state=="Morning");emit+=Time.unscaledDeltaTime;if(emit>.15f){emit=0;
#if UNITY_WEBGL && !UNITY_EDITOR
        ShopSnapshot(JsonUtility.ToJson(Sample()));
#endif
    }}
    public void Tick(float dt){store.Tick(dt);}
    [Serializable] public class Snapshot {
        public ShopForecast prediction;public int staffCount,labor,totalLabor,twoStaffDays,parallelFrames,stockerMoves;public string stockerState;public Vector3 stockerPosition;public string state,panel,clock,period,clerkState;public int day,cash,weather,orderCost,active,queue,spawned,movementSamples,staffMoves,restocks,checkouts,pickups,emptyEvents,maxQueue,waitingFrames,missedWithWarehouse,totalProfit,totalSold,totalWaste,totalMissed,inventoryValue,electricity,selectedShelf;
        public float elapsed,speed,sceneFraction=.77f;public bool inventoryMatches;public int[] stock,order,price,warehouse;public StoreShelf[] shelves;public DayReport report,displayedResult;public DayReport[] history;public ProductTotal[] productTotals;public int[] salesDelta;public Vector3 clerkPosition;public CustomerState[] customers;
    }
    [Serializable] public class CustomerState {public int product,stage;public bool carrying;public Vector3 position;}
    public Snapshot Sample(){var cs=new CustomerState[store.customers.Count];for(int i=0;i<cs.Length;i++){var c=store.customers[i];cs[i]=new CustomerState{product=c.product,stage=c.stage,carrying=c.carrying,position=c.position};}return new Snapshot{prediction=model.state=="Morning"&&(panel=="仕入れ"||panel=="価格")?Prediction():null,staffCount=model.staffCount,labor=ShopModel.LaborCost(model.staffCount),totalLabor=model.totalLabor,twoStaffDays=model.twoStaffDays,parallelFrames=store.parallelFrames,stockerMoves=store.stockerMoves,stockerState=store.stockerState,stockerPosition=store.stockerPosition,state=model.state,panel=panel,clock=store.Clock(),period=store.Period(),clerkState=store.clerkState,day=model.day,cash=model.cash,weather=model.weather,orderCost=model.OrderCost(),active=store.customers.Count,queue=store.queue.Count,spawned=store.spawned,movementSamples=store.moved,staffMoves=store.staffMoves,restocks=store.restocks,checkouts=store.checkouts,pickups=store.pickups,emptyEvents=store.emptyEvents,maxQueue=store.maxQueue,waitingFrames=store.waitingFrames,missedWithWarehouse=store.missedWithWarehouse,totalProfit=model.totalProfit,totalSold=model.totalSold,totalWaste=model.totalWaste,totalMissed=model.totalMissed,inventoryValue=model.InventoryValue(),electricity=store.Electricity(),selectedShelf=selectedShelf,elapsed=store.elapsed,speed=store.speed,stock=model.stock,order=model.order,price=model.price,warehouse=store.warehouse,shelves=store.shelves,report=model.report,displayedResult=model.state=="Result"?model.report:panel=="前日の結果"&&history.Count>0?history[history.Count-1]:null,history=history.ToArray(),productTotals=ProductTotals(),salesDelta=SalesDelta(model.state=="Result"?model.report:panel=="前日の結果"&&history.Count>0?history[history.Count-1]:null),inventoryMatches=store.InventoryMatches(),clerkPosition=store.clerkPosition,customers=cs};}
    public static string Money(int value)=>value.ToString("N0")+"円";
    public static string Range(ForecastRange r,bool money=false){return r.low.ToString("N0")+"〜"+r.high.ToString("N0")+(money?"円":"個");}
    GUIStyle detail,wrapped;
    void Styles(){if(styled)return;styled=true;paper=new Texture2D(1,1);paper.SetPixel(0,0,Color.white);paper.Apply();text=new GUIStyle(GUI.skin.label){font=view.japanese,fontSize=18,normal={textColor=new Color(.2f,.29f,.29f)}};small=new GUIStyle(text){fontSize=15};detail=new GUIStyle(text){fontSize=12};wrapped=new GUIStyle(small){fontSize=14,wordWrap=true};title=new GUIStyle(text){fontSize=28,fontStyle=FontStyle.Bold};button=new GUIStyle(GUI.skin.button){font=view.japanese,fontSize=19,alignment=TextAnchor.MiddleCenter,padding=new RectOffset(8,8,2,2)};foreach(var s in new[]{button.normal,button.hover,button.active,button.focused}){s.background=paper;s.textColor=new Color(.17f,.29f,.26f);}}
    void Box(Rect rect,Color color){GUI.color=color;GUI.DrawTexture(rect,paper);GUI.color=Color.white;}
    void Label(float x,float y,float width,string value,GUIStyle style=null){GUI.Label(new Rect(x,y,width,40),value,style??text);}
    bool Button(float x,float y,float w,float h,string value,bool enabled=true,bool selected=false){GUI.enabled=enabled;GUI.backgroundColor=selected?new Color(.52f,.83f,.66f):new Color(.92f,.96f,.89f);bool hit=GUI.Button(new Rect(x,y,w,h),value,button);GUI.backgroundColor=Color.white;GUI.enabled=true;return hit;}
    Vector2 ScreenPoint(Vector3 world){var p=view.cameraView.WorldToScreenPoint(world);return new Vector2(p.x/Screen.width*1200,(1-p.y/Screen.height)*720);}
    void Sign(Vector3 world,string value,float width=120){var p=ScreenPoint(world);Box(new Rect(p.x-width/2,p.y,width,29),new Color(1,.99f,.94f,.95f));GUI.Label(new Rect(p.x-width/2+5,p.y,width-10,28),value,small);}
    void OnGUI(){if(!view||model==null)return;Styles();GUI.color=Color.white;GUI.enabled=true;GUI.matrix=Matrix4x4.Scale(new Vector3(Screen.width/1200f,Screen.height/720f,1));
        Box(new Rect(0,0,1200,72),new Color(1,.99f,.94f));Label(25,6,350,"ちいさなコンビニ",title);Label(390,11,150,model.day+"日目 / 7");Label(550,11,210,store.Clock()+"  "+(model.state=="Open"?store.Period():model.state=="Morning"?"開店準備":"閉店"));Label(810,11,355,"所持金  "+Money(model.cash));Label(28,42,450,"今日の天気      "+ShopModel.WeatherNames[model.weather],small);Box(new Rect(112,50,12,12),model.weather==4?new Color(.49f,.67f,.83f):model.weather==3?new Color(.35f,.6f,.72f):model.weather==2?new Color(.95f,.51f,.25f):model.weather==1?new Color(1,.78f,.3f):new Color(.48f,.69f,.48f));Label(570,42,390,"本日売上  "+Money(model.state!="Morning"&&model.report!=null?model.report.revenue:0),small);Label(1000,42,180,model.state=="Open"?(store.elapsed>=StoreSimulation.DaySeconds?"閉店の片付け":"営業中"):model.state=="Morning"?"開店準備":"閉店",small);
        WorldLabels();Footer();if(model.state=="Result")Result(model.report,false);else if(model.state=="Final")Final();else if(panel=="前日の結果"&&history.Count>0)Result(history[history.Count-1],true);else if(panel=="仕入れ")OrderPanel();else if(panel=="価格")PricePanel();else if(panel=="棚配置")LayoutPanel();
    }

    void WorldLabels(){Sign(new Vector3(0,2.45f,4.9f),"ちいさなコンビニ",180);Sign(new Vector3(5.1f,.5f,4.65f),"バックヤード",130);Sign(new Vector3(4.8f,1.45f,-3.85f),"レジ",62);
        for(int i=0;i<6;i++){var s=store.shelves[i];var at=StoreSimulation.Slots[s.slot]+new Vector3(0,2.05f,0);string name=ShopModel.Products[s.product].name;Sign(at,name+(s.refrigerated?" / 冷蔵":""),s.refrigerated?150:105);if(model.state=="Open"&&s.stock<=Math.Max(2,s.capacity/3)){var p=ScreenPoint(at);GUI.Label(new Rect(p.x-55,p.y+27,110,25),s.stock==0?"空っぽ":"あと少し",small);}}
        foreach(var c in store.customers)if(c.bubbleUntil>store.elapsed)Sign(c.position+Vector3.up*2.05f,c.bubble,100);
        if(model.state=="Open"){Sign(store.clerkPosition+Vector3.up*2.25f,store.clerkState,110);if(model.staffCount==2)Sign(store.stockerPosition+Vector3.up*2.25f,store.stockerState,110);}
        if(Time.unscaledTime<feedbackUntil)Sign(StoreSimulation.Register+Vector3.up*2.3f,feedback,130);
    }
    void Footer(){Box(new Rect(0,626,1200,94),new Color(1,.99f,.94f));
        if(model.state=="Morning"){Label(26,632,1100,ShopModel.Hints[model.weather]+"  冷蔵棚の電気代 "+Money(store.Electricity())+" / 日",small);if(history.Count>0&&Button(975,631,195,30,"前日の結果"))panel="前日の結果";if(Button(30,671,225,38,"仕入れ"))panel="仕入れ";if(Button(270,671,225,38,"価格"))panel="価格";if(Button(510,671,225,38,"棚配置"))panel="棚配置";if(Button(750,671,420,38,"開店",model.OrderCost()<=model.cash))Open();}
        else if(model.state=="Open"){Label(27,636,785,store.elapsed>=StoreSimulation.DaySeconds?"22:00 新しいお客さんの入店は終了。会計と退店を待っています。":"棚が空いたら店員が品出し。品出し中はレジに列ができます。",small);Label(27,671,530,"店員 "+model.staffCount+"人 / レジ  "+store.clerkState+"   /   レジ待ち "+store.queue.Count+"人",small);for(int i=0;i<3;i++){float rate=i==0?1:i==1?2:4;if(Button(810+i*122,671,110,38,"×"+rate,true,store.speed==rate))store.speed=rate;}}
        else Label(28,651,1100,"店を眺めて、明日の仕入れと棚配置を考えよう。",small);
    }
    void Modal(string heading,float x,float y,float w,float h){Box(new Rect(0,72,1200,554),new Color(.22f,.32f,.3f,.23f));Box(new Rect(x+7,y+7,w,h),new Color(.3f,.35f,.32f,.3f));Box(new Rect(x,y,w,h),new Color(1,.99f,.94f));Label(x+24,y+16,w-48,heading,title);}
    void OrderPanel(){PreparationPanel(false);}
    void PricePanel(){PreparationPanel(true);}
    void PreparationPanel(bool pricing){
        Modal(pricing?"価格設定と本日の予測":"仕入れと本日の予測",30,82,1140,536);
        Label(55,143,265,"天気："+ShopModel.WeatherNames[model.weather]+" / 店員",small);
        if(Button(305,139,120,32,"1人",true,model.staffCount==1))SetStaff(1);if(Button(440,139,245,32,"2人（追加 "+Money(ShopModel.ExtraLabor)+"）",true,model.staffCount==2))SetStaff(2);
        var f=Prediction();Label(710,146,425,"人件費 "+Money(f.labor)+" / 日（1人目含む）",small);
        Box(new Rect(55,182,1090,48),new Color(.91f,.95f,.88f));Label(65,184,670,"予想売上 "+Range(f.revenue,true)+"  /  粗利益 "+Range(f.gross,true),small);Label(65,207,700,"仕入れ "+Money(f.purchases)+"  廃棄損失 "+Range(f.waste,true)+"  電気代 "+Money(f.electricity),detail);Label(760,186,375,"予想利益 "+Range(f.profit,true));
        Label(55,236,610,pricing?"高価格は購入率が下がります。価格は1個あたり。":"在庫＋追加で予定在庫。開店時に仕入れ確定。",small);Label(710,236,420,"商品別の概算（中央80%の範囲）",small);
        string[] names={"安め","標準","高め","強気"};int[] change={-5,-1,1,5};for(int i=0;i<5;i++){
            float y=265+i*57;Box(new Rect(55,y-2,1090,55),i%2==0?new Color(.96f,.96f,.9f):new Color(1,.99f,.94f));Label(65,y,120,ShopModel.Products[i].name);
            if(pricing){for(int k=0;k<4;k++)if(Button(195+k*121,y,110,28,names[k],true,model.price[i]==k))model.price[i]=k;Label(195,y+30,450,Money(model.SellingPrice(i))+" / 1個の粗利益 "+Money(model.SellingPrice(i)-ShopModel.Products[i].cost),small);}
            else{Label(195,y,145,"在庫 "+model.stock[i]+" / +"+model.order[i],small);for(int k=0;k<4;k++)if(Button(375+k*72,y,65,29,change[k]>0?"+"+change[k]:change[k].ToString()))model.order[i]=Mathf.Clamp(model.order[i]+change[k],0,ShopModel.Products[i].maxDaily*2);Label(195,y+29,450,"予定 "+f.products[i].planned_stock+"個 / 原価 "+Money(ShopModel.Products[i].cost)+(model.OrderCost()>model.cash?"  資金不足":""),small);}
            var p=f.products[i];Label(710,y,205,"販売 "+Range(p.units),small);Label(915,y,230,"売上 "+Range(p.revenue,true),small);Label(710,y+18,205,"粗利益 "+Range(p.gross,true),detail);Label(915,y+18,230,"残在庫 "+Range(p.remaining),detail);Label(710,y+36,425,"売切リスク "+p.shortageRisk+"  /  廃棄リスク "+p.wasteRisk,detail);
        }
        Label(55,553,1090,f.warning+"  予想機会損失 "+f.missed.low+"〜"+f.missed.high+"件",small);
        if(Button(361,584,478,29,"決定"))panel="";
    }
    void LayoutPanel(){Modal("棚配置",270,100,660,510);Label(294,154,605,"棚を選ぶ → 商品や置き場所を選ぶ。占有済みの場所は交換。",small);
        for(int i=0;i<6;i++)if(Button(294+i*100,193,94,34,"棚"+(i+1),true,selectedShelf==i))selectedShelf=i;
        var s=store.shelves[selectedShelf];Label(294,240,606,(s.refrigerated?"冷蔵棚":"通常棚")+" / 容量 "+s.capacity+" / "+ShopModel.Products[s.product].name);Label(294,276,606,s.refrigerated?"冷蔵棚は弁当・飲料に対応。電気代300円 / 日。":"通常棚は全商品に対応。電気代なし。",small);
        for(int i=0;i<5;i++)if(Button(294+i*122,315,115,34,ShopModel.Products[i].name,!s.refrigerated||i==1||i==2,s.product==i))store.Assign(selectedShelf,i);
        Label(294,365,606,"置き場所：奥は入口から遠く、右奥は倉庫に近い。",small);for(int i=0;i<8;i++){string[] locations={"左奥","中央奥","右奥","左中央","中央","左手前","中央手前","右中央"};if(Button(294+(i%4)*153,403+(i/4)*47,145,36,locations[i],true,s.slot==i))store.Place(selectedShelf,i);}
        if(Button(294,553,612,34,"決定"))panel="";
    }
    public ProductTotal[] ProductTotals(){var totals=new ProductTotal[5];for(int i=0;i<5;i++)totals[i]=new ProductTotal{product_id=i};foreach(var day in history)foreach(var r in day.products){totals[r.product_id].units_sold+=r.units_sold;totals[r.product_id].revenue+=r.revenue;}return totals;}
    public int[] SalesDelta(DayReport r){if(r==null||r.day==1)return null;var previous=history.Find(d=>d.day==r.day-1);if(previous==null)return null;var delta=new int[5];for(int i=0;i<5;i++)delta[i]=r.sales[i]-previous.sales[i];return delta;}
    void Metric(float x,string heading,string value){Box(new Rect(x,145,204,77),new Color(.91f,.95f,.88f));Label(x+12,150,180,heading,small);Label(x+12,176,185,value,title);}
    void Result(DayReport r,bool review){
        Modal(review?"前日の営業結果  /  "+r.day+"日目":"本日の営業結果  /  "+r.day+"日目",45,82,1110,540);
        if(r.forecast!=null)Label(630,113,500,"予想利益 "+Range(r.forecast.profit,true)+"（目安）",small);
        Metric(70,"本日の売上",Money(r.revenue));Metric(284,"本日の利益",Money(r.profit));Metric(498,"販売個数合計",r.sold+"個");Metric(712,"廃棄損失",Money(r.wasteCost));Metric(926,"機会損失",r.missed+"件");
        Label(70,231,1040,"仕入れ "+Money(r.purchases)+"    粗利益 "+Money(r.revenue-r.soldCost)+"    電気代 "+Money(r.electricity)+"    人件費 "+Money(r.laborCost)+" / 店員"+r.staffCount+"人",small);
        Label(70,247,1050,"売切れは一時的な棚欠品を含みます。残在庫は廃棄後。販売数・売上の下段は開店時の予測。",detail);
        float[] x={80,202,310,439,514,604,692,803};string[] heads={"商品","販売数","売上","廃棄","売切れ","機会損失","残在庫","翌日へのヒント"};
        Box(new Rect(70,266,1060,30),new Color(.84f,.9f,.82f));for(int j=0;j<x.Length;j++)Label(x[j],269,j==7?330:110,heads[j],small);
        var delta=SalesDelta(r);for(int i=0;i<5;i++){float y=301+i*52;var p=r.products[i];Box(new Rect(70,y-2,1060,50),i%2==0?new Color(.96f,.96f,.9f):new Color(1,.99f,.94f));Label(x[0],y,118,ShopModel.Products[i].name);Label(x[1],y-5,100,p.units_sold+"個");if(r.forecast!=null){Label(x[1],y+17,100,"予測 "+Range(r.forecast.products[i].units),detail);Label(x[2],y+20,126,"予測 "+Range(r.forecast.products[i].revenue,true),detail);}if(delta!=null)Label(x[1],y+31,100,"前日比 "+(delta[i]>0?"+":"")+delta[i],detail);Label(x[2],y-5,126,Money(p.revenue));Label(x[3],y,70,p.waste_count+"個");Label(x[4],y,86,p.sold_out?"あり":"なし",small);Label(x[5],y,86,p.opportunity_loss_count+"件");Label(x[6],y,105,p.ending_stock+"個");GUI.Label(new Rect(x[7],y+3,330,47),p.comment,wrapped);}
        Label(70,562,1070,r.staffComment,small);
        if(Button(361,590,478,30,review?"準備に戻る":r.day==7?"7日間の結果へ":"翌日の準備へ")){if(review)panel="";else Next();}
    }
    void Final(){
        Modal("7日間の結果",160,100,880,505);Label(190,157,410,"合計利益  "+Money(model.totalProfit),title);Label(650,157,360,"売上  "+Money(model.totalRevenue));Label(190,207,815,"販売 "+model.totalSold+"個 / 廃棄 "+model.totalWaste+"個 / 機会損失 "+model.totalMissed+"件");
        Label(190,239,815,"最終資金 "+Money(model.cash)+"    電気代 "+Money(model.totalElectricity)+"    人件費 "+Money(model.totalLabor)+" / 2人使用 "+model.twoStaffDays+"日",small);
        int low=0,high=0,mean=0;foreach(var r in history)if(r.forecast!=null){low+=r.forecast.profit.low;high+=r.forecast.profit.high;mean+=r.forecast.profit.mean;}Label(190,268,815,"7日間予想利益 "+Money(low)+"〜"+Money(high)+" / 予測平均との差 "+Money(model.totalProfit-mean),small);
        Box(new Rect(190,304,820,32),new Color(.84f,.9f,.82f));Label(210,307,250,"商品",small);Label(470,307,240,"7日間の販売数",small);Label(730,307,260,"7日間の売上",small);var totals=ProductTotals();for(int i=0;i<5;i++){float y=344+i*39;Label(210,y,250,ShopModel.Products[i].name);Label(470,y,240,totals[i].units_sold+"個");Label(730,y,260,Money(totals[i].revenue));}
        if(Button(361,552,478,36,"もう一度"))Retry();
    }
}







