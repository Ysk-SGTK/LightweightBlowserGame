using System;
using System.Collections.Generic;
using UnityEngine;

// Small, fixed town scene. Geometry is independent of demand and accounting.
public class StoreView : MonoBehaviour {
    public Material[] materials;public Camera cameraView;public Font japanese;
    public Transform town,clerk,stocker;public Transform[] shelfRoots=new Transform[6];[NonSerialized] public GameObject[][] boxes=new GameObject[6][];
    public GameObject clerkBag;readonly List<GameObject> rain=new List<GameObject>();
    public static readonly int[] ProductColors={5,6,7,8,9};
    public GameObject Shape(string name,PrimitiveType type,Vector3 position,Vector3 scale,int color,Transform parent){var o=GameObject.CreatePrimitive(type);o.name=name;o.transform.SetParent(parent);o.transform.localPosition=position;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=materials[color];var c=o.GetComponent<Collider>();if(Application.isPlaying)Destroy(c);else DestroyImmediate(c);return o;}
    public void Build(StoreSimulation sim){if(town){if(Application.isPlaying)Destroy(town.gameObject);else DestroyImmediate(town.gameObject);}town=new GameObject("街と店舗").transform;town.SetParent(transform);
        Shape("芝生",PrimitiveType.Cube,new Vector3(0,-.28f,-1),new Vector3(30,.3f,25),0,town);
        Shape("道路",PrimitiveType.Cube,new Vector3(0,-.07f,-9.2f),new Vector3(28,.12f,3.2f),2,town);
        Shape("歩道",PrimitiveType.Cube,new Vector3(0,0,-6.5f),new Vector3(25,.16f,2.4f),3,town);
        for(int x=-12;x<=12;x+=4)Shape("車線",PrimitiveType.Cube,new Vector3(x,.005f,-9.2f),new Vector3(2,.02f,.1f),4,town);
        Shape("お店の土台",PrimitiveType.Cube,new Vector3(0,.02f,.1f),new Vector3(14.4f,.36f,10.6f),3,town);
        Shape("店内の床",PrimitiveType.Cube,new Vector3(0,.21f,.1f),new Vector3(14,.08f,10.2f),1,town);
        for(int x=-6;x<=6;x+=2)Shape("床の継ぎ目",PrimitiveType.Cube,new Vector3(x,.258f,.1f),new Vector3(.025f,.012f,10),3,town);
        for(int z=-4;z<=4;z+=2)Shape("床の継ぎ目",PrimitiveType.Cube,new Vector3(0,.259f,z),new Vector3(14,.01f,.025f),3,town);
        Shape("奥の壁",PrimitiveType.Cube,new Vector3(0,1.45f,5.2f),new Vector3(14.3f,2.7f,.2f),4,town);
        Shape("左の壁",PrimitiveType.Cube,new Vector3(-7,1,.2f),new Vector3(.2f,1.8f,10),4,town);
        Shape("店の看板帯",PrimitiveType.Cube,new Vector3(0,2.2f,5.03f),new Vector3(14,.42f,.12f),10,town);
        Shape("アクセント帯",PrimitiveType.Cube,new Vector3(0,1.86f,5.02f),new Vector3(14,.12f,.14f),5,town);
        Shape("バックヤード",PrimitiveType.Cube,new Vector3(5.2f,.285f,3.7f),new Vector3(3.3f,.05f,2.5f),11,town);
        for(int i=0;i<3;i++)Shape("倉庫の段ボール",PrimitiveType.Cube,new Vector3(5+i*.5f,.55f,4),new Vector3(.55f,.6f,.6f),12,town);
        Shape("レジ台",PrimitiveType.Cube,new Vector3(4.7f,.63f,-3.15f),new Vector3(2,.7f,.85f),10,town);
        Shape("カウンター天板",PrimitiveType.Cube,new Vector3(4.7f,1.04f,-3.15f),new Vector3(2.1f,.12f,.95f),4,town);
        Shape("レジ画面",PrimitiveType.Cube,new Vector3(4.9f,1.35f,-3.1f),new Vector3(.45f,.42f,.18f),13,town);
        Shape("レジの液晶",PrimitiveType.Cube,new Vector3(4.9f,1.35f,-3.2f),new Vector3(.35f,.28f,.025f),7,town);
        Shape("入口マット",PrimitiveType.Cube,new Vector3(-1.4f,.28f,-4.7f),new Vector3(1.7f,.025f,1),10,town);
        for(int i=0;i<6;i++){var s=sim.shelves[i];var root=new GameObject("棚 "+(i+1)).transform;root.SetParent(town);shelfRoots[i]=root;
            Shape("棚の土台",PrimitiveType.Cube,new Vector3(0,.48f,0),new Vector3(2,.45f,.8f),s.refrigerated?7:12,root);
            Shape("棚の背板",PrimitiveType.Cube,new Vector3(0,1,.36f),new Vector3(2,1,.1f),s.refrigerated?7:4,root);
            for(int level=0;level<2;level++)Shape("陳列板",PrimitiveType.Cube,new Vector3(0,.7f+level*.36f,0),new Vector3(2.05f,.08f,.82f),4,root);
            boxes[i]=new GameObject[8];for(int b=0;b<8;b++)boxes[i][b]=Shape("商品箱",PrimitiveType.Cube,new Vector3(-.7f+(b%4)*.46f,.85f+(b/4)*.36f,-.02f),new Vector3(.3f,.23f,.35f),ProductColors[s.product],root);
        }
        clerk=Person("店員",10,town,1.18f);Shape("エプロン",PrimitiveType.Cube,new Vector3(0,.72f,-.19f),new Vector3(.32f,.36f,.04f),4,clerk);clerk.position=StoreSimulation.Register;clerkBag=clerk.Find("商品").gameObject;
        stocker=Person("追加店員・品出し担当",7,town,1.18f);Shape("エプロン",PrimitiveType.Cube,new Vector3(0,.72f,-.19f),new Vector3(.32f,.36f,.04f),4,stocker);stocker.position=StoreSimulation.Backyard;stocker.gameObject.SetActive(sim.model.staffCount==2);
        for(int side=-1;side<=1;side+=2){float x=side*10.2f;
            Shape("小さな建物",PrimitiveType.Cube,new Vector3(x,1.4f,3.5f),new Vector3(3,3,5),side<0?14:11,town);
            Shape("屋根",PrimitiveType.Cube,new Vector3(x,3.03f,3.5f),new Vector3(3.3f,.3f,5.3f),side<0?6:10,town);
            for(int w=0;w<2;w++)Shape("窓",PrimitiveType.Cube,new Vector3(x-.6f+w*1.2f,1.8f,.96f),new Vector3(.65f,.8f,.06f),7,town);
            Shape("木の幹",PrimitiveType.Cylinder,new Vector3(side*8.5f,.75f,-3.8f),new Vector3(.24f,.75f,.24f),12,town);
            Shape("木の葉",PrimitiveType.Sphere,new Vector3(side*8.5f,2,-3.8f),new Vector3(1.9f,2,1.7f),0,town);
            Shape("街灯",PrimitiveType.Cylinder,new Vector3(side*8.4f,1.2f,-6.9f),new Vector3(.12f,1.2f,.12f),13,town);
            Shape("街灯の光",PrimitiveType.Sphere,new Vector3(side*8.4f,2.5f,-6.9f),new Vector3(.46f,.6f,.46f),5,town);
        }
        rain.Clear();for(int i=0;i<30;i++){var drop=Shape("雨",PrimitiveType.Cube,new Vector3(-11+i*.77f,1+(i%4)*.35f,-6.7f),new Vector3(.025f,.3f,.025f),7,town);drop.transform.rotation=Quaternion.Euler(0,0,15);rain.Add(drop);}
        Refresh(sim,true);
    }
    public Transform Person(string name,int color,Transform parent,float size){var root=new GameObject(name).transform;root.SetParent(parent);root.localScale=Vector3.one*size;
        Shape("服",PrimitiveType.Capsule,new Vector3(0,.71f,0),new Vector3(.46f,.32f,.37f),color,root);
        Shape("頭",PrimitiveType.Sphere,new Vector3(0,1.13f,0),new Vector3(.37f,.4f,.37f),15,root);
        Shape("髪",PrimitiveType.Sphere,new Vector3(0,1.28f,.025f),new Vector3(.39f,.2f,.37f),13,root);
        for(int side=-1;side<=1;side+=2){Shape("足",PrimitiveType.Capsule,new Vector3(side*.12f,.39f,0),new Vector3(.15f,.22f,.16f),13,root);Shape("腕",PrimitiveType.Capsule,new Vector3(side*.29f,.74f,0),new Vector3(.12f,.24f,.12f),15,root);}
        var bag=Shape("商品",PrimitiveType.Cube,new Vector3(.32f,.76f,-.18f),new Vector3(.32f,.28f,.26f),12,root);bag.SetActive(false);return root;
    }
    public void Spawn(StoreSimulation.Shopper c){c.body=Person("お客さん "+c.product,ProductColors[c.product],town,.9f+(c.speed-6.1f)*.15f).gameObject;c.body.transform.position=c.position;}
    public void Refresh(StoreSimulation sim,bool preparation=false){int[] preview=(int[])sim.model.stock.Clone();for(int p=0;p<5;p++)preview[p]+=sim.model.order[p];for(int i=0;i<6;i++){var s=sim.shelves[i];shelfRoots[i].position=StoreSimulation.Slots[s.slot];int count=preparation?Mathf.Min(s.capacity,preview[s.product]):s.stock;if(preparation)preview[s.product]-=count;int visible=count==0?0:Mathf.Max(1,Mathf.CeilToInt(count/(float)s.capacity*8));for(int b=0;b<8;b++){boxes[i][b].SetActive(b<visible);boxes[i][b].GetComponent<Renderer>().sharedMaterial=materials[ProductColors[s.product]];}}
        clerk.position=sim.clerkPosition;clerkBag.SetActive(sim.carried>0);stocker.gameObject.SetActive(sim.model.staffCount==2);stocker.position=sim.stockerPosition;stocker.Find("商品").gameObject.SetActive(sim.stockerCarried>0);foreach(var c in sim.customers)if(c.body){c.body.transform.Find("商品").gameObject.SetActive(c.carrying);float swing=Mathf.Sin(sim.elapsed*15+c.speed)*.05f;c.body.transform.localRotation=Quaternion.Euler(0,0,c.stage==3||c.stage==5?0:swing*35);}
        for(int i=0;i<rain.Count;i++){rain[i].SetActive(sim.model.weather==3);if(sim.model.weather==3)rain[i].transform.localPosition=new Vector3(-11+i*.77f,2.6f-Mathf.Repeat(sim.elapsed*3+i*.2f,2.4f),-6.7f);}
    }
}





