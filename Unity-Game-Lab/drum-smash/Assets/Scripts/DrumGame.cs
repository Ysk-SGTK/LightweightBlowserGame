using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using UnityEngine;

public class DrumGame : MonoBehaviour
{
    public GameObject barrelPrefab, ballPrefab;
    public Material guideMaterial;
    public Camera view;
    public Transform contents;
    public List<DrumBarrel> barrels = new List<DrumBarrel>();
    public int fallen, shots, combo, impacts, sparks, shakes;
    public string state = "READY";
    public bool ready;
    public float maxBarrelSpeed, maxBarrelHeight, shotAge;
    public Vector3 lastVelocity;
    public int generation;
    public const float BallMass = 14, BarrelMass = 4;
    public readonly Vector3 launchPosition = new Vector3(0, 0.85f, -7);
    Rigidbody loaded;
    List<Rigidbody> balls = new List<Rigidbody>();
    LineRenderer guide;
    ParticleSystem dust;
    Vector3 cameraHome;
    float shakeUntil, lastFall = -10, sampleAt, stillTime;
    bool dragging;
    Vector2 dragStart, dragNow;
    AudioSource audioSource;
    AudioClip clang, clearTone;
    [DllImport("__Internal")] static extern void DrumSample(string json);
    [Serializable] public class Snapshot {
        public string state; public int fallen, score, shots, combo, impacts, sparks, shakes, generation;
        public bool ready, dragging; public float time, maxBarrelSpeed, maxBarrelHeight, ballSpeed, vx, vy, vz;
    }
    public Snapshot Sample() => new Snapshot {state=state, fallen=fallen, score=fallen*100, shots=shots,
        combo=combo, impacts=impacts, sparks=sparks, shakes=shakes, generation=generation, ready=ready,
        dragging=dragging, time=Time.time, maxBarrelSpeed=maxBarrelSpeed, maxBarrelHeight=maxBarrelHeight,
        ballSpeed=balls.Count>0 && balls[balls.Count-1] ? balls[balls.Count-1].linearVelocity.magnitude:0,
        vx=lastVelocity.x,vy=lastVelocity.y,vz=lastVelocity.z};
    void Start() {
        cameraHome=view.transform.position;
        var line = new GameObject("Aim trajectory"); guide=line.AddComponent<LineRenderer>();
        guide.material=guideMaterial; guide.startWidth=0.055f; guide.endWidth=0.025f; guide.positionCount=18;
        guide.startColor=new Color(1,.75f,.2f); guide.endColor=new Color(1,.75f,.2f,.15f);
        var fx=new GameObject("Impact sparks"); dust=fx.AddComponent<ParticleSystem>(); dust.Stop();
        var main=dust.main; main.loop=false; main.playOnAwake=false; main.duration=.25f;
        main.startLifetime=new ParticleSystem.MinMaxCurve(.15f,.38f); main.startSpeed=new ParticleSystem.MinMaxCurve(1.2f,3.2f);
        main.startSize=new ParticleSystem.MinMaxCurve(.035f,.085f); main.startColor=new Color(1,.68f,.18f);
        main.gravityModifier=1; main.maxParticles=64; main.simulationSpace=ParticleSystemSimulationSpace.World;
        var em=dust.emission; em.enabled=false; var shape=dust.shape; shape.shapeType=ParticleSystemShapeType.Sphere; shape.radius=.08f;
        dust.GetComponent<ParticleSystemRenderer>().material=guideMaterial;
        audioSource=gameObject.AddComponent<AudioSource>(); audioSource.spatialBlend=0; audioSource.volume=.22f;
        clang=Tone("Metal",.17f,false); clearTone=Tone("Clear",.45f,true);
        Retry();
    }
    AudioClip Tone(string name,float duration,bool bright) {
        var clip=AudioClip.Create(name,(int)(44100*duration),1,44100,false); var data=new float[clip.samples];
        for(int i=0;i<data.Length;i++){float t=i/44100f; float f=bright?(t<.15f?523:t<.3f?659:784):155;
            data[i]=(Mathf.Sin(t*f*6.283f)*.6f+Mathf.Sin(t*f*2.73f*6.283f)*.25f)*Mathf.Exp(-t*(bright?5:28));}
        clip.SetData(data,0); return clip;
    }
    public void Retry() {
        if(contents) { contents.gameObject.SetActive(false); Destroy(contents.gameObject); }
        contents=new GameObject("Round objects").transform;
        barrels.Clear(); balls.Clear(); fallen=shots=combo=impacts=sparks=shakes=0;
        maxBarrelSpeed=maxBarrelHeight=shotAge=stillTime=0; lastFall=lastImpact=-10; shakeUntil=0; dragging=false;
        lastVelocity=Vector3.zero; generation++; state="READY"; ready=true; view.transform.position=cameraHome;
        if(dust) dust.Stop(true,ParticleSystemStopBehavior.StopEmittingAndClear);
        for(int row=0;row<5;row++) for(int col=0;col<5-row;col++) {
            var obj=Instantiate(barrelPrefab,new Vector3((col-(4-row)*.5f)*1.02f,.56f+row*1.12f,5),Quaternion.identity,contents);
            obj.name="Drum "+(barrels.Count+1); var barrel=obj.GetComponent<DrumBarrel>(); barrel.game=this; barrels.Add(barrel);
        }
        LoadBall();
    }
    void LoadBall(){ var obj=Instantiate(ballPrefab,launchPosition,Quaternion.identity,contents); loaded=obj.GetComponent<Rigidbody>();
        loaded.isKinematic=true; obj.GetComponent<DrumBall>().game=this; }
    public Vector3 DragVelocity(Vector2 delta) {
        float power=Mathf.Clamp01(delta.magnitude/(Screen.height*.38f));
        float side=Mathf.Clamp(-delta.x/(Screen.width*.24f),-1.3f,1.3f);
        return new Vector3(side,.22f,1).normalized*Mathf.Lerp(9,23,power);
    }
    public bool Launch(Vector3 velocity) {
        if(!ready||shots>=3||state=="CLEAR"||state=="GAME OVER") return false;
        ready=false; state="FLYING"; shots++; shotAge=stillTime=0; loaded.isKinematic=false;
        loaded.linearVelocity=velocity; lastVelocity=velocity; balls.Add(loaded); loaded=null; dragging=false; return true;
    }
    public void Knocked(DrumBarrel barrel){
        fallen++; combo=Time.time-lastFall<.85f?combo+1:1; lastFall=Time.time;
        if(fallen>=12 && state!="CLEAR") {state="CLEAR"; ready=false; dragging=false; if(audioSource) audioSource.PlayOneShot(clearTone);}
    }
    public void Impact(Vector3 point,float speed) {
        if(speed<3 || Time.time<lastImpact+.09f) return;
        lastImpact=Time.time; impacts++; sparks++; shakes++; shakeUntil=Time.time+.14f;
        dust.transform.position=point; dust.Emit(16); audioSource.PlayOneShot(clang,Mathf.Clamp01(speed/18));
    }
    float lastImpact=-10;
    void Update() {
        foreach(var b in barrels) {maxBarrelSpeed=Mathf.Max(maxBarrelSpeed,b.body.linearVelocity.magnitude); maxBarrelHeight=Mathf.Max(maxBarrelHeight,b.transform.position.y);}
        if(state=="FLYING") {
            shotAge+=Time.deltaTime; bool moving=false;
            foreach(var b in barrels) if(!b.body.IsSleeping()&&(b.body.linearVelocity.sqrMagnitude>.035f||b.body.angularVelocity.sqrMagnitude>.06f)) moving=true;
            foreach(var b in balls) if(b && b.position.y> -5 && b.linearVelocity.sqrMagnitude>.06f) moving=true;
            stillTime=moving?0:stillTime+Time.deltaTime;
            // Misses leave the finite floor and are eventually removed. Final result waits for the pile.
            if(shotAge>2 && stillTime>.8f) {
                if(shots==3) state="GAME OVER"; else {state="READY";ready=true;LoadBall();}
            } else if(shots<3 && shotAge>7) {state="READY";ready=true;LoadBall();}
        }
        if(ready && Input.GetMouseButtonDown(0) && Input.mousePosition.y<Screen.height*.78f && Input.mousePosition.y>Screen.height*.16f) {
            dragStart=dragNow=Input.mousePosition; dragging=true;
        }
        if(dragging){dragNow=Input.mousePosition; if(Input.GetMouseButtonUp(0)){if((dragNow-dragStart).magnitude>12) Launch(DragVelocity(dragNow-dragStart)); else dragging=false;}}
        guide.enabled=ready; if(ready){Vector3 v=DragVelocity(dragging?dragNow-dragStart:new Vector2(0,Screen.height*.25f));
            for(int i=0;i<18;i++){float t=i*.045f;guide.SetPosition(i,launchPosition+v*t+.5f*Physics.gravity*t*t);}}
        view.transform.position=cameraHome+(Time.time<shakeUntil?UnityEngine.Random.insideUnitSphere*.035f:Vector3.zero);
        foreach(var b in balls) if(b && b.position.y< -20){b.gameObject.SetActive(false); b.Sleep();}
#if UNITY_WEBGL && !UNITY_EDITOR
        if(Time.unscaledTime>sampleAt){sampleAt=Time.unscaledTime+.15f;DrumSample(JsonUtility.ToJson(Sample()));}
#endif
    }
    void OnGUI() {
        float scale=Mathf.Min(Screen.width/1200f,Screen.height/720f); GUI.matrix=Matrix4x4.TRS(Vector3.zero,Quaternion.identity,Vector3.one*scale);
        float w=Screen.width/scale,h=Screen.height/scale;
        var label=new GUIStyle(GUI.skin.label){fontSize=23,fontStyle=FontStyle.Bold}; label.normal.textColor=new Color(.93f,.94f,.90f);
        var small=new GUIStyle(label){fontSize=17,fontStyle=FontStyle.Normal};
        GUI.color=new Color(.05f,.07f,.09f,.93f);GUI.DrawTexture(new Rect(0,0,w,86),Texture2D.whiteTexture);GUI.color=Color.white;
        GUI.Label(new Rect(28,13,400,35),"DRUM SMASH",label);GUI.Label(new Rect(28,49,430,30),"3 SHOTS  /  12 DRUMS TO CLEAR",small);
        GUI.Label(new Rect(w-520,15,220,30),"SCORE  "+(fallen*100).ToString("0000"),label);
        GUI.Label(new Rect(w-285,15,280,30),"DRUMS  "+fallen+" / 15",label);
        GUI.Label(new Rect(w-285,49,270,30),"BALL  "+(3-shots)+" / 3",small);
        if(combo>1 && Time.time-lastFall<1.5f){GUI.color=new Color(1,.73f,.22f);GUI.Label(new Rect(w/2-100,100,280,40),"COMBO  x"+combo,label);GUI.color=Color.white;}
        GUI.color=new Color(.05f,.07f,.09f,.9f);GUI.DrawTexture(new Rect(0,h-68,w,68),Texture2D.whiteTexture);GUI.color=Color.white;
        string hint=ready?"DRAG DOWN TO PULL  /  LEFT OR RIGHT TO AIM  /  RELEASE TO THROW":"WAIT FOR THE PILE TO SETTLE";
        GUI.Label(new Rect(28,h-52,w-230,40),hint,small);
        if(GUI.Button(new Rect(w-160,h-54,130,40),"RETRY"))Retry();
        if(state=="CLEAR"||state=="GAME OVER") {
            GUI.color=new Color(.04f,.06f,.08f,.95f);GUI.DrawTexture(new Rect(w/2-240,h/2-135,480,270),Texture2D.whiteTexture);GUI.color=Color.white;
            var big=new GUIStyle(label){fontSize=42,alignment=TextAnchor.MiddleCenter};
            GUI.Label(new Rect(w/2-230,h/2-110,460,65),fallen==15?"PERFECT":state,big);
            GUI.Label(new Rect(w/2-185,h/2-34,400,40),"SCORE "+fallen*100+"    DRUMS "+fallen+" / 15",label);
            GUI.Label(new Rect(w/2-120,h/2+9,320,35),"BALLS USED  "+shots+" / 3",small);
            if(GUI.Button(new Rect(w/2-110,h/2+62,220,48),"RETRY"))Retry();
        }
    }
}
