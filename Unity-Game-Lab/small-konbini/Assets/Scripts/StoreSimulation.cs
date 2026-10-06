using System;
using System.Collections.Generic;
using UnityEngine;

[Serializable] public class StoreShelf {
    public int slot,product,capacity,stock; public bool refrigerated;
    public StoreShelf(int s,int p,int cap,bool cold=false){slot=s;product=p;capacity=cap;refrigerated=cold;}
}
public class StoreSimulation {
    public const float DaySeconds=45;
    public static readonly Vector3 Entrance=new Vector3(-1.4f,0,-5.6f),Register=new Vector3(4.7f,0,-2.7f),Backyard=new Vector3(5.2f,0,3.6f);
    public static readonly Vector3[] Slots={new Vector3(-4,0,2.5f),new Vector3(0,0,2.5f),new Vector3(3,0,1.6f),new Vector3(-4,0,-.3f),new Vector3(0,0,-.3f),new Vector3(-4,0,-3),new Vector3(0,0,-3),new Vector3(3,0,-.5f)};
    public readonly StoreShelf[] shelves={new StoreShelf(0,0,8),new StoreShelf(1,1,8),new StoreShelf(2,2,10,true),new StoreShelf(3,3,10),new StoreShelf(4,4,8),new StoreShelf(5,0,8)};
    public class Shopper {public GameObject body;public int product,shelf,stage,result,path;public float speed,timer,bubbleUntil;public Vector3 position;public string bubble="";public bool carrying,paid;}
    public readonly List<Shopper> customers=new List<Shopper>(),queue=new List<Shopper>();
    public readonly int[] warehouse=new int[5]; public ShopModel model; public float elapsed,speed=1;
    public int spawned,planned,moved,restocks,checkouts,pickups,emptyEvents,maxQueue,waitingFrames,missedWithWarehouse,staffMoves;
    public Vector3 clerkPosition=Register;public string clerkState="レジ待機";public int job=-1,carried,carriedProduct=-1;float clerkTimer,arrivalBudget;int clerkPath;
    public Vector3 stockerPosition=Backyard;public string stockerState="品出し待機";public int stockerJob=-1,stockerCarried,stockerProduct=-1,parallelFrames,stockerMoves;float stockerTimer;int stockerPath;
    public Action<Shopper> spawnView,removeView;public Action<int> sold; System.Random random;
    public StoreSimulation(ShopModel economy,int seed){model=economy;random=new System.Random(seed);}
    public bool Place(int shelf,int slot){if(model.state!="Morning"||shelf<0||shelf>=shelves.Length||slot<0||slot>=Slots.Length)return false;int old=shelves[shelf].slot;foreach(var s in shelves)if(s.slot==slot)s.slot=old;shelves[shelf].slot=slot;return true;}
    public bool Assign(int shelf,int product){if(model.state!="Morning"||shelf<0||shelf>=shelves.Length||product<0||product>=5)return false;var s=shelves[shelf];if(s.refrigerated&&product!=1&&product!=2)return false;s.product=product;return true;}
    public int Electricity(){int cost=0;foreach(var s in shelves)if(s.refrigerated)cost+=300;return cost;}
    public bool Open(){if(!model.Open())return false;elapsed=0;spawned=0;stockerPosition=Backyard;stockerState="品出し待機";stockerJob=-1;stockerCarried=0;stockerProduct=-1;stockerTimer=0;stockerPath=0;planned=model.VisitCount();arrivalBudget=0;queue.Clear();customers.Clear();clerkPosition=Register;clerkState="レジ待機";job=-1;carried=0;carriedProduct=-1;clerkTimer=0;for(int i=0;i<5;i++)warehouse[i]=model.stock[i];foreach(var s in shelves){s.stock=Math.Min(s.capacity,warehouse[s.product]);warehouse[s.product]-=s.stock;}return true;}
    public string Clock(){int minutes=480+(int)(Mathf.Clamp01(elapsed/DaySeconds)*840);return (minutes/60).ToString("00")+":"+(minutes%60).ToString("00");}
    public string Period(){float hour=8+14*Mathf.Clamp01(elapsed/DaySeconds);return hour<11?"朝":hour<14?"昼":hour<18?"夕方":"夜";}
    float Traffic(){float h=8+14*elapsed/DaySeconds;return h<11?.7f:h<14?1.35f:h<18?1.2f:.8f;}
    public int ShelfFor(int product){int best=-1;float distance=float.MaxValue;for(int i=0;i<shelves.Length;i++){var s=shelves[i];if(s.product!=product)continue;float d=Vector3.Distance(Entrance,Slots[s.slot])+(s.stock==0?30:0);if(d<distance){distance=d;best=i;}}return best;}
    Vector3 ShelfFront(int index)=>index<0?new Vector3(-1.4f,0,.5f):Slots[shelves[index].slot]+new Vector3(0,0,-.95f);
    Vector3 QueuePoint(int index)=>new Vector3(4.7f-index*.85f,0,-3.85f);
    bool Move(ref Vector3 pos,Vector3 target,float dt,float velocity,bool staff=false){Vector3 old=pos;pos=Vector3.MoveTowards(pos,target,velocity*dt);if(pos!=old){if(staff)staffMoves++;else moved++;}return Vector3.Distance(pos,target)<.025f;}
    bool Walk(ref Vector3 pos,Vector3 target,ref int path,float dt,float velocity,bool staff=false){float lane=staff?1.5f:-1.6f;Vector3 waypoint=path==0?new Vector3(lane,0,pos.z):path==1?new Vector3(lane,0,target.z):target;if(Move(ref pos,waypoint,dt,velocity,staff)){if(path<2){path++;return false;}return true;}return false;}
    void Spawn(){int product=model.Candidate();if(product<0){spawned=planned;return;}var c=new Shopper{product=product,shelf=ShelfFor(product),position=new Vector3(-9,0,-6.4f),speed=6.1f+(float)random.NextDouble()*1.1f};customers.Add(c);spawned++;spawnView?.Invoke(c);}
    public void Tick(float dt){if(model.state!="Open")return;dt*=speed;elapsed+=dt;
        if(elapsed<DaySeconds){arrivalBudget+=dt*planned/DaySeconds*Traffic();if(arrivalBudget>=1&&customers.Count<16&&spawned<planned){arrivalBudget-=1;Spawn();}}
        for(int n=customers.Count-1;n>=0;n--){var c=customers[n];
            if(c.stage==0){if(Move(ref c.position,Entrance,dt,c.speed))c.stage=1;}
            else if(c.stage==1){if(Move(ref c.position,new Vector3(-1.4f,0,-4.1f),dt,c.speed))c.stage=2;}
            else if(c.stage==2){if(Walk(ref c.position,ShelfFront(c.shelf),ref c.path,dt,c.speed)){c.stage=3;c.timer=.4f;c.path=0;}}
            else if(c.stage==3){c.timer-=dt;if(c.timer<=0){bool available=c.shelf>=0&&shelves[c.shelf].stock>0;c.result=model.Decide(c.product,available);if(c.result==1){shelves[c.shelf].stock--;c.carrying=true;pickups++;c.bubble="あった！";c.stage=4;}else {c.bubble=c.result==-1?"ない…":"高いな…";if(c.result==-1){emptyEvents++;if(warehouse[c.product]>0)missedWithWarehouse++;}c.stage=7;c.timer=.65f;}c.bubbleUntil=elapsed+1.1f;}}
            else if(c.stage==4){if(Walk(ref c.position,new Vector3(1.3f,0,-4.1f),ref c.path,dt,c.speed)&&queue.Count<4){queue.Add(c);maxQueue=Math.Max(maxQueue,queue.Count);c.stage=5;c.path=0;}}
            else if(c.stage==5){int index=queue.IndexOf(c);Move(ref c.position,QueuePoint(index),dt,c.speed);if(clerkState!="レジ待機")waitingFrames++;}
            else if(c.stage==7){c.timer-=dt;if(c.timer<=0&&Walk(ref c.position,Entrance,ref c.path,dt,c.speed))c.stage=8;}
            else if(c.stage==8){if(Move(ref c.position,new Vector3(9,0,-6.4f),dt,c.speed)){removeView?.Invoke(c);customers.RemoveAt(n);continue;}}
            if(c.body)c.body.transform.position=c.position;
        }
        Clerk(dt);if(model.staffCount==2){var previous=stockerPosition;Stocker(dt);if(Vector3.Distance(previous,stockerPosition)>.001f)stockerMoves++;if(clerkState=="お会計"&&stockerJob>=0)parallelFrames++;}
        if(elapsed>=DaySeconds&&customers.Count==0&&carried==0&&stockerCarried==0){model.Close(Electricity());foreach(var s in shelves)s.stock=0;for(int i=0;i<5;i++)warehouse[i]=model.stock[i];}
    }
    void Clerk(float dt){
        if(job>=0){var shelf=shelves[job];if(clerkState=="倉庫へ"){if(Walk(ref clerkPosition,Backyard,ref clerkPath,dt,5,true)){carriedProduct=shelf.product;carried=Math.Min(shelf.capacity-shelf.stock,warehouse[shelf.product]);warehouse[shelf.product]-=carried;clerkTimer=.35f;clerkState="商品を用意";clerkPath=0;}}
            else if(clerkState=="商品を用意"){clerkTimer-=dt;if(clerkTimer<=0)clerkState="品出しへ";}
            else if(clerkState=="品出しへ"){if(Walk(ref clerkPosition,ShelfFront(job),ref clerkPath,dt,5,true)){clerkTimer=.55f;clerkState="補充中";clerkPath=0;}}
            else if(clerkState=="補充中"){clerkTimer-=dt;if(clerkTimer<=0){int put=Math.Min(carried,shelf.capacity-shelf.stock);shelf.stock+=put;warehouse[carriedProduct]+=carried-put;carried=0;carriedProduct=-1;restocks++;job=-1;clerkState="レジへ";}}
            return;
        }
        if(queue.Count>0){clerkState="レジへ";if(Walk(ref clerkPosition,Register,ref clerkPath,dt,5,true)){clerkState="レジ待機";var c=queue[0];if(Vector3.Distance(c.position,QueuePoint(0))<.04f){clerkState="お会計";clerkTimer+=dt;if(clerkTimer>=.75f){model.Checkout(c.product);c.paid=true;c.carrying=false;c.stage=7;c.path=0;c.timer=0;c.bubble="ありがとう";c.bubbleUntil=elapsed+.8f;queue.RemoveAt(0);checkouts++;sold?.Invoke(model.SellingPrice(c.product));clerkTimer=0;clerkState="レジ待機";}}}return;}
        clerkTimer=0;
        if(elapsed<DaySeconds&&model.staffCount==1){job=RefillTarget();if(job>=0){clerkState="倉庫へ";clerkPath=0;return;}}
        if(Walk(ref clerkPosition,Register,ref clerkPath,dt,5,true))clerkState="レジ待機";else clerkState="レジへ";
    }
    int RefillTarget(){int target=-1;float lowest=1;for(int i=0;i<shelves.Length;i++){var s=shelves[i];float fill=s.stock/(float)s.capacity;if(s.stock<=Math.Max(2,s.capacity/3)&&warehouse[s.product]>0&&fill<lowest){lowest=fill;target=i;}}return target;}
    void Stocker(float dt){
        if(stockerJob<0){if(elapsed<DaySeconds)stockerJob=RefillTarget();if(stockerJob<0){if(Walk(ref stockerPosition,Backyard,ref stockerPath,dt,5,true))stockerState="品出し待機";else stockerState="倉庫へ";return;}stockerState="倉庫へ";stockerPath=0;}
        var shelf=shelves[stockerJob];
        if(stockerState=="倉庫へ"){if(Walk(ref stockerPosition,Backyard,ref stockerPath,dt,5,true)){stockerProduct=shelf.product;stockerCarried=Math.Min(shelf.capacity-shelf.stock,warehouse[shelf.product]);warehouse[shelf.product]-=stockerCarried;stockerTimer=.35f;stockerState="商品を用意";stockerPath=0;}}
        else if(stockerState=="商品を用意"){stockerTimer-=dt;if(stockerTimer<=0)stockerState="品出しへ";}
        else if(stockerState=="品出しへ"){if(Walk(ref stockerPosition,ShelfFront(stockerJob),ref stockerPath,dt,5,true)){stockerTimer=.55f;stockerState="補充中";stockerPath=0;}}
        else if(stockerState=="補充中"){stockerTimer-=dt;if(stockerTimer<=0){int put=Math.Min(stockerCarried,shelf.capacity-shelf.stock);shelf.stock+=put;warehouse[stockerProduct]+=stockerCarried-put;stockerCarried=0;stockerProduct=-1;restocks++;stockerJob=-1;stockerState="品出し待機";stockerPath=0;}}
    }
    public bool InventoryMatches(){for(int i=0;i<5;i++){int count=warehouse[i];foreach(var s in shelves)if(s.product==i)count+=s.stock;foreach(var c in customers)if(c.product==i&&c.carrying)count++;if(carriedProduct==i)count+=carried;if(stockerProduct==i)count+=stockerCarried;if(count!=model.stock[i])return false;}return true;}
}




