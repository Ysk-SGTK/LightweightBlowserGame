using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.Rendering;

// Presentation only: all slot positions, stock and actor states belong to StoreSimulation.
public class StoreView : MonoBehaviour {
    public Material[] materials; public Camera cameraView; public Font japanese;
    public Transform town,clerk,stocker; public Transform[] shelfRoots=new Transform[6];
    [NonSerialized] public GameObject[][] boxes=new GameObject[6][];
    public GameObject clerkBag; readonly List<GameObject> rain=new List<GameObject>();
    public static readonly int[] ProductColors={5,6,7,8,9};
    readonly int[] shownProducts={-1,-1,-1,-1,-1,-1};
    readonly Dictionary<string,Mesh> meshCache=new Dictionary<string,Mesh>(); Material atlasMaterial; Mesh riceMesh; readonly List<Mesh> generated=new List<Mesh>();
    public static readonly Color[] Palette={
        new Color(.62f,.71f,.63f),new Color(.91f,.87f,.76f),new Color(.38f,.45f,.47f),new Color(.72f,.77f,.72f),
        new Color(.99f,.98f,.91f),new Color(.94f,.63f,.22f),new Color(.85f,.33f,.25f),new Color(.35f,.69f,.75f),
        new Color(.72f,.46f,.37f),new Color(.45f,.65f,.49f),new Color(.13f,.38f,.35f),new Color(.73f,.83f,.80f),
        new Color(.57f,.43f,.29f),new Color(.17f,.24f,.24f),new Color(.72f,.70f,.61f),new Color(.97f,.77f,.58f)};
    static void Release(UnityEngine.Object o){if(Application.isPlaying)UnityEngine.Object.Destroy(o);else UnityEngine.Object.DestroyImmediate(o);}
    void InitMaterials(){if(atlasMaterial)return;
        var copies=new Material[Palette.Length];for(int i=0;i<copies.Length;i++){copies[i]=new Material(materials[i]);copies[i].color=Palette[i];copies[i].SetFloat("_Glossiness",.12f);}materials=copies;
        var atlas=new Texture2D(16,1,TextureFormat.RGBA32,false);atlas.filterMode=FilterMode.Point;atlas.wrapMode=TextureWrapMode.Clamp;atlas.SetPixels(Palette);atlas.Apply();
        atlasMaterial=new Material(materials[4]);atlasMaterial.color=Color.white;atlasMaterial.mainTexture=atlas;atlasMaterial.enableInstancing=true;
    }
    public GameObject Shape(string name,PrimitiveType type,Vector3 position,Vector3 scale,int color,Transform parent){var o=GameObject.CreatePrimitive(type);o.name=name;o.transform.SetParent(parent,false);o.transform.localPosition=position;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=materials[color];var c=o.GetComponent<Collider>();if(Application.isPlaying)Release(c);else DestroyImmediate(c);return o;}
    GameObject Cube(string name,Transform parent,float x,float y,float z,float sx,float sy,float sz,int color)=>Shape(name,PrimitiveType.Cube,new Vector3(x,y,z),new Vector3(sx,sy,sz),color,parent);
    Transform Root(string name,Transform parent){var t=new GameObject(name).transform;t.SetParent(parent,false);return t;}
    // Bake visual pieces to one atlas draw per object, retaining the logical shelf root.
    void Bake(Transform root,string cacheKey=null){if(cacheKey!=null&&meshCache.TryGetValue(cacheKey,out var cached)){foreach(Transform child in root)Release(child.gameObject);root.gameObject.AddComponent<MeshFilter>().sharedMesh=cached;root.gameObject.AddComponent<MeshRenderer>().sharedMaterial=atlasMaterial;return;}var filters=root.GetComponentsInChildren<MeshFilter>();var parts=new List<CombineInstance>();var temporary=new List<Mesh>();foreach(var f in filters){var r=f.GetComponent<MeshRenderer>();if(!r||f.transform==root)continue;int color=Array.IndexOf(materials,r.sharedMaterial);if(color<0)continue;var mesh=Instantiate(f.sharedMesh);var uv=new Vector2[mesh.vertexCount];for(int i=0;i<uv.Length;i++)uv[i]=new Vector2((color+.5f)/16f,.5f);mesh.uv=uv;temporary.Add(mesh);parts.Add(new CombineInstance{mesh=mesh,transform=root.worldToLocalMatrix*f.transform.localToWorldMatrix});r.enabled=false;Release(f.gameObject);}
        if(parts.Count==0)return;var combined=new Mesh{name=root.name+" visual mesh",indexFormat=IndexFormat.UInt32};combined.CombineMeshes(parts.ToArray());generated.Add(combined);if(cacheKey!=null)meshCache[cacheKey]=combined;root.gameObject.AddComponent<MeshFilter>().sharedMesh=combined;root.gameObject.AddComponent<MeshRenderer>().sharedMaterial=atlasMaterial;foreach(var m in temporary)Release(m);
    }
    public void Build(StoreSimulation sim){InitMaterials();if(town)Release(town.gameObject);foreach(var m in generated)if(m)Release(m);generated.Clear();meshCache.Clear();town=Root("街と店舗",transform);var environment=Root("街並み・固定造形",town);
        Cube("街の地面",environment,0,-.28f,-1,30,.3f,25,0);
        Cube("道路",environment,0,-.07f,-9.2f,28,.12f,3.2f,2);Cube("歩道",environment,0,0,-6.5f,25,.16f,2.4f,3);
        Cube("縁石",environment,0,.09f,-7.68f,25,.16f,.16f,4);
        for(int x=-12;x<=12;x+=4)Cube("車線",environment,x,.005f,-9.2f,2,.02f,.08f,3);
        Cube("店舗の基壇",environment,0,.02f,.1f,14.4f,.36f,10.6f,10);Cube("店内の床",environment,0,.21f,.1f,14,.08f,10.2f,3);
        for(int x=-6;x<=6;x+=2)for(int z=-4;z<=4;z+=2)Cube("床タイル",environment,x,.256f,z,1.96f,.014f,1.96f,1);
        Cube("奥の壁",environment,0,1.45f,5.2f,14.3f,2.7f,.2f,4);Cube("左の壁",environment,-7,1,.2f,.2f,1.8f,10,4);
        Cube("壁際の巾木",environment,0,.42f,5.03f,14,.25f,.12f,10);Cube("左の巾木",environment,-6.87f,.4f,.2f,.1f,.25f,10,10);
        Cube("オリジナル看板帯",environment,0,2.23f,5.01f,14,.65f,.18f,10);Cube("琥珀のアクセント",environment,0,1.84f,4.99f,14,.09f,.2f,5);
        Cube("バックヤード床",environment,5.2f,.285f,3.7f,3.3f,.05f,2.5f,14);
        Cube("倉庫ドア",environment,5.1f,1.08f,4.98f,1.35f,1.65f,.13f,11);Cube("ドア窓",environment,5.1f,1.43f,4.89f,.7f,.48f,.05f,2);Cube("ドアノブ",environment,5.57f,.98f,4.85f,.07f,.13f,.1f,5);
        for(int i=0;i<3;i++){Cube("段ボール",environment,5+i*.55f,.55f,4,.48f,.55f,.55f,12);Cube("梱包テープ",environment,5+i*.55f,.83f,4,.10f,.012f,.55f,1);}
        Cube("カウンター接地影",environment,4.7f,.269f,-3.15f,2.25f,.014f,1.05f,14);
        Cube("レジ台",environment,4.7f,.63f,-3.15f,2,.7f,.85f,10);Cube("カウンター前板",environment,4.7f,.72f,-3.59f,1.8f,.42f,.04f,4);Cube("カウンターライン",environment,4.7f,.52f,-3.62f,1.8f,.065f,.02f,5);
        Cube("天板",environment,4.7f,1.04f,-3.15f,2.12f,.1f,.98f,1);Cube("レジ台座",environment,4.9f,1.13f,-3.1f,.38f,.10f,.34f,13);Cube("レジ画面",environment,4.9f,1.36f,-3.1f,.48f,.4f,.14f,13);Cube("液晶",environment,4.9f,1.37f,-3.19f,.38f,.28f,.025f,7);
        Cube("会計トレー",environment,4.24f,1.12f,-3.32f,.42f,.035f,.25f,5);Cube("袋置き場",environment,5.38f,1.15f,-3.18f,.3f,.13f,.36f,4);
        Cube("入口マット",environment,-1.4f,.28f,-4.7f,1.85f,.025f,1.0f,10);for(int i=0;i<4;i++)Cube("マット織り",environment,-1.4f,.298f,-4.98f+i*.18f,1.6f,.008f,.025f,11);
        // Cutaway side glazing leaves entrance and customer path visible.
        for(int side=-1;side<=1;side+=2){float x=-1.4f+side*1.22f;Cube("入口フレーム",environment,x,.95f,-5.05f,.10f,1.4f,.13f,10);Cube("ガラス下部",environment,x+side*.40f,.78f,-5.05f,.75f,.85f,.05f,11);Cube("ガラス反射",environment,x+side*.4f,1.09f,-5.09f,.63f,.035f,.015f,4);}
        for(int side=-1;side<=1;side+=2){float x=side*10.2f;Cube("周辺建物",environment,x,1.4f,3.5f,3,3,5,14);Cube("周辺屋根",environment,x,3.03f,3.5f,3.3f,.3f,5.3f,2);for(int w=0;w<2;w++)Cube("周辺窓",environment,x-.6f+w*1.2f,1.8f,.96f,.65f,.8f,.06f,11);Shape("幹",PrimitiveType.Cylinder,new Vector3(side*8.5f,.75f,-3.8f),new Vector3(.20f,.75f,.20f),12,environment);Shape("葉",PrimitiveType.Sphere,new Vector3(side*8.5f,2,-3.8f),new Vector3(1.8f,1.85f,1.65f),0,environment);Shape("街灯",PrimitiveType.Cylinder,new Vector3(side*8.4f,1.2f,-6.9f),new Vector3(.09f,1.2f,.09f),13,environment);Shape("街灯ランプ",PrimitiveType.Sphere,new Vector3(side*8.4f,2.5f,-6.9f),new Vector3(.35f,.46f,.35f),1,environment);}
        Bake(environment);
        for(int i=0;i<6;i++){var s=sim.shelves[i];var root=Root("棚 "+(i+1),town);shelfRoots[i]=root;var frame=Root("棚フレーム",root);
            Cube("接地",frame,0,.274f,0,2.2f,.012f,1,14);Cube("台輪",frame,0,.39f,0,2,.23f,.85f,s.refrigerated?10:12);Cube("背板",frame,0,.93f,.38f,2,.98f,.07f,s.refrigerated?2:11);
            for(int side=-1;side<=1;side+=2){Cube("棚脚",frame,side*.95f,.73f,.3f,.09f,1.05f,.1f,10);if(s.refrigerated){Cube("冷蔵側面",frame,side*1.01f,.94f,0,.08f,1.12f,.88f,11);Cube("ケース前縁",frame,side*.99f,.89f,-.4f,.035f,1.05f,.05f,4);}}
            for(int level=0;level<2;level++){float y=.64f+level*.43f;Cube("棚板",frame,0,y,0,2.03f,.07f,.87f,4);Cube("価格レール",frame,0,y-.015f,-.45f,2.02f,.11f,.045f,10);for(int k=0;k<4;k++)Cube("小さな値札",frame,-.72f+k*.47f,y,-.48f,.18f,.052f,.015f,1);}
            if(s.refrigerated){Cube("冷蔵ヘッダー",frame,0,1.54f,.31f,2.13f,.18f,.23f,10);Cube("ケース照明",frame,0,1.43f,.21f,1.82f,.025f,.1f,4);}Bake(frame);shownProducts[i]=-1;}
        clerk=Person("店員・レジ",10,town,1.18f);clerk.position=StoreSimulation.Register;clerkBag=clerk.Find("商品").gameObject;
        stocker=Person("追加店員・品出し",7,town,1.18f);stocker.position=StoreSimulation.Backyard;
        rain.Clear();for(int i=0;i<30;i++){var drop=Shape("雨",PrimitiveType.Cube,new Vector3(-11+i*.77f,1+(i%4)*.35f,-6.7f),new Vector3(.025f,.3f,.025f),7,town);drop.transform.rotation=Quaternion.Euler(0,0,15);rain.Add(drop);}
        Refresh(sim,true);
    }
    Mesh Rice(){if(riceMesh)return riceMesh;riceMesh=new Mesh{name="三角おにぎり"};riceMesh.vertices=new[]{new Vector3(-.5f,0,-.5f),new Vector3(.5f,0,-.5f),new Vector3(0,1,-.5f),new Vector3(-.5f,0,.5f),new Vector3(.5f,0,.5f),new Vector3(0,1,.5f)};riceMesh.triangles=new[]{0,2,1,3,4,5,0,1,4,0,4,3,1,2,5,1,5,4,2,0,3,2,3,5};riceMesh.RecalculateNormals();return riceMesh;}
    GameObject Product(int product,Transform parent,Vector3 position){var t=Root(ShopModel.Products[product].name,parent);t.localPosition=position;
        if(product==0){var rice=Root("三角包み",t);rice.gameObject.AddComponent<MeshFilter>().sharedMesh=Rice();rice.gameObject.AddComponent<MeshRenderer>().sharedMaterial=materials[4];rice.localScale=new Vector3(.36f,.32f,.20f);Cube("海苔",t,0,.075f,-.107f,.12f,.15f,.025f,13);Cube("包装の印",t,.08f,.18f,-.109f,.055f,.04f,.012f,6);}
        else if(product==1){Cube("弁当容器",t,0,.055f,0,.4f,.10f,.30f,13);Cube("ごはん",t,-.08f,.115f,0,.19f,.05f,.25f,4);Cube("おかず",t,.10f,.12f,.03f,.12f,.06f,.16f,8);Cube("野菜",t,.11f,.12f,-.10f,.12f,.05f,.07f,9);Cube("梅",t,-.08f,.15f,0,.05f,.015f,.05f,6);}
        else if(product==2){Shape("飲料ボトル",PrimitiveType.Cylinder,new Vector3(0,.15f,0),new Vector3(.19f,.15f,.19f),7,t);Shape("ラベル",PrimitiveType.Cylinder,new Vector3(0,.15f,0),new Vector3(.195f,.055f,.195f),4,t);Cube("キャップ",t,0,.32f,0,.1f,.055f,.1f,5);}
        else if(product==3){var bag=Cube("菓子袋",t,0,.17f,0,.3f,.34f,.18f,8);bag.transform.localRotation=Quaternion.Euler(-8,0,0);Cube("袋の帯",t,0,.19f,-.10f,.25f,.11f,.025f,5);Cube("袋のシール",t,0,.32f,-.025f,.29f,.035f,.19f,4);}
        else{Cube("日用品の箱",t,0,.11f,0,.35f,.22f,.25f,9);Cube("箱のラベル",t,0,.13f,-.132f,.27f,.12f,.02f,4);Cube("ティッシュ",t,0,.25f,0,.12f,.08f,.08f,4);}Bake(t,"product-"+product);return t.gameObject;
    }
    public Transform Person(string name,int color,Transform parent,float size){var root=Root(name,parent);root.localScale=Vector3.one*size;var body=Root("人物",root);
        Shape("服",PrimitiveType.Capsule,new Vector3(0,.71f,0),new Vector3(.46f,.32f,.37f),color,body);Shape("顔",PrimitiveType.Sphere,new Vector3(0,1.13f,0),new Vector3(.37f,.4f,.37f),15,body);Shape("髪",PrimitiveType.Sphere,new Vector3(0,1.28f,.025f),new Vector3(.39f,.2f,.37f),13,body);
        for(int side=-1;side<=1;side+=2){Shape("足",PrimitiveType.Capsule,new Vector3(side*.12f,.39f,0),new Vector3(.15f,.22f,.16f),13,body);Shape("腕",PrimitiveType.Capsule,new Vector3(side*.29f,.74f,0),new Vector3(.12f,.24f,.12f),15,body);}if(name.Contains("店員"))Cube("エプロン",body,0,.72f,-.19f,.32f,.36f,.04f,4);Bake(body,"person-"+color+"-"+name.Contains("店員"));var bag=Cube("商品",root,.32f,.76f,-.18f,.32f,.28f,.26f,12);bag.SetActive(false);return root;
    }
    public void Spawn(StoreSimulation.Shopper c){c.body=Person("お客さん "+c.product,ProductColors[c.product],town,.9f+(c.speed-6.1f)*.15f).gameObject;c.body.transform.position=c.position;}
    public void Refresh(StoreSimulation sim,bool preparation=false){int[] preview=(int[])sim.model.stock.Clone();for(int p=0;p<5;p++)preview[p]+=sim.model.order[p];for(int i=0;i<6;i++){var s=sim.shelves[i];shelfRoots[i].position=StoreSimulation.Slots[s.slot];if(shownProducts[i]!=s.product){if(boxes[i]!=null)foreach(var old in boxes[i])if(old)Release(old);boxes[i]=new GameObject[8];for(int b=0;b<8;b++)boxes[i][b]=Product(s.product,shelfRoots[i],new Vector3(-.70f+(b%4)*.47f,.69f+(b/4)*.43f,-.07f));shownProducts[i]=s.product;}int count=preparation?Mathf.Min(s.capacity,preview[s.product]):s.stock;if(preparation)preview[s.product]-=count;int visible=count==0?0:Mathf.Max(1,Mathf.CeilToInt(count/(float)s.capacity*8));for(int b=0;b<8;b++)boxes[i][b].SetActive(b<visible);}
        clerk.position=sim.clerkPosition;clerkBag.SetActive(sim.carried>0);stocker.gameObject.SetActive(sim.model.staffCount==2);stocker.position=sim.stockerPosition;stocker.Find("商品").gameObject.SetActive(sim.stockerCarried>0);foreach(var c in sim.customers)if(c.body){c.body.transform.Find("商品").gameObject.SetActive(c.carrying);float swing=Mathf.Sin(sim.elapsed*15+c.speed)*.05f;c.body.transform.localRotation=Quaternion.Euler(0,0,c.stage==3||c.stage==5?0:swing*35);}
        for(int i=0;i<rain.Count;i++){rain[i].SetActive(sim.model.weather==3);if(sim.model.weather==3)rain[i].transform.localPosition=new Vector3(-11+i*.77f,2.6f-Mathf.Repeat(sim.elapsed*3+i*.2f,2.4f),-6.7f);}
    }
}
