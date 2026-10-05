using System;
using System.IO;
using System.Collections.Generic;
using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;

[InitializeOnLoad]
public static class DrumAutomation {
    static string Evidence => Path.Combine(Application.dataPath,"../evidence");
    static int errors,phase,misses;
    static float at;
    static bool stable,blocked,clear,over,dedup,retry,direction;
    static DrumGame.Snapshot natural;
    static List<string> checks=new List<string>();
    static double playStart;
    static DrumAutomation(){if(SessionState.GetBool("DrumTesting",false)){Application.logMessageReceived+=LogError;EditorApplication.update+=Test;}}
    static void LogError(string m,string trace,LogType type){if(type==LogType.Error||type==LogType.Exception||type==LogType.Assert){errors++;}}
    static Material Material(string name,Color color,float metal,float smooth){var m=new Material(Shader.Find("Standard"));m.color=color;m.SetFloat("_Metallic",metal);m.SetFloat("_Glossiness",smooth);AssetDatabase.CreateAsset(m,"Assets/Materials/"+name+".mat");return m;}
    static GameObject Primitive(string name,PrimitiveType type,Vector3 pos,Vector3 scale,Material mat,Transform parent=null,bool collider=true){var o=GameObject.CreatePrimitive(type);o.name=name;o.transform.SetParent(parent);o.transform.position=pos;o.transform.localScale=scale;o.GetComponent<Renderer>().sharedMaterial=mat;if(!collider)UnityEngine.Object.DestroyImmediate(o.GetComponent<Collider>());return o;}
    static Mesh Ring(){var mesh=new Mesh();var vertices=new List<Vector3>();var triangles=new List<int>();int n=32,k=6;
        for(int i=0;i<=n;i++)for(int j=0;j<=k;j++){float a=i*Mathf.PI*2/n,b=j*Mathf.PI*2/k;float r=.476f+.028f*Mathf.Cos(b);vertices.Add(new Vector3(r*Mathf.Cos(a),.028f*Mathf.Sin(b),r*Mathf.Sin(a)));}
        for(int i=0;i<n;i++)for(int j=0;j<k;j++){int p=i*(k+1)+j;triangles.AddRange(new[]{p,p+k+1,p+1,p+1,p+k+1,p+k+2});}
        mesh.SetVertices(vertices);mesh.SetTriangles(triangles,0);mesh.RecalculateNormals();AssetDatabase.CreateAsset(mesh,"Assets/Materials/DrumRing.asset");return mesh;}
    public static void CreateAndPlay(){
        Directory.CreateDirectory(Evidence);Directory.CreateDirectory("Assets/Materials");Directory.CreateDirectory("Assets/Prefabs");Directory.CreateDirectory("Assets/Scenes");
        EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
        var teal=Material("PaintedSteel",new Color(.11f,.4f,.43f),.55f,.36f);
        var rims=Material("SteelRims",new Color(.21f,.28f,.3f),.72f,.5f);
        var steel=Material("HeavyBall",new Color(.22f,.25f,.3f),.85f,.67f);
        var floorMat=Material("Concrete",new Color(.14f,.16f,.18f),.05f,.2f);
        var dark=Material("Warehouse",new Color(.075f,.095f,.12f),.2f,.2f);
        var yellow=Material("SafetyYellow",new Color(.9f,.58f,.14f),.1f,.3f);
        var guide=new Material(Shader.Find("Particles/Standard Unlit"));guide.color=new Color(1,.72f,.18f);AssetDatabase.CreateAsset(guide,"Assets/Materials/Sparks.mat");
        var friction=new PhysicsMaterial("Steel friction"){dynamicFriction=.55f,staticFriction=.65f,bounciness=.04f,frictionCombine=PhysicsMaterialCombine.Average,bounceCombine=PhysicsMaterialCombine.Minimum};AssetDatabase.CreateAsset(friction,"Assets/Materials/Steel.physicsMaterial");
        var ballFriction=new PhysicsMaterial("Heavy ball friction"){dynamicFriction=.45f,staticFriction=.6f,bounciness=.03f,bounceCombine=PhysicsMaterialCombine.Minimum};AssetDatabase.CreateAsset(ballFriction,"Assets/Materials/Ball.physicsMaterial");
        var floor=Primitive("Floor",PrimitiveType.Cube,new Vector3(0,-.25f,0),new Vector3(18,.5f,20),floorMat);floor.GetComponent<Collider>().sharedMaterial=friction;
        Primitive("Back wall",PrimitiveType.Cube,new Vector3(0,4,11),new Vector3(22,8,.4f),dark);
        for(int i=-2;i<=2;i++)Primitive("Warehouse support",PrimitiveType.Cube,new Vector3(i*4.5f,4,10.65f),new Vector3(.2f,8,.22f),rims);
        Primitive("Target zone",PrimitiveType.Cube,new Vector3(0,.003f,5),new Vector3(6,.005f,2),dark,null,false);
        for(int i=-1;i<=1;i+=2)Primitive("Safety lane",PrimitiveType.Cube,new Vector3(i*3.3f,.012f,-1),new Vector3(.08f,.008f,14),yellow,null,false);
        Primitive("Launch marker",PrimitiveType.Cylinder,new Vector3(0,.015f,-7),new Vector3(2.5f,.012f,2.5f),yellow,null,false);
        var barrel=new GameObject("Drum");
        Primitive("Painted cylinder",PrimitiveType.Cylinder,Vector3.zero,new Vector3(.95f,.55f,.95f),teal,barrel.transform,false);
        Primitive("Lid",PrimitiveType.Cylinder,new Vector3(0,.549f,0),new Vector3(.89f,.006f,.89f),rims,barrel.transform,false);
        Primitive("Bung",PrimitiveType.Cylinder,new Vector3(.23f,.563f,0),new Vector3(.11f,.014f,.11f),dark,barrel.transform,false);
        var ring=Ring();foreach(float y in new[]{-.53f,-.3f,.3f,.53f}){var o=new GameObject("Rolled steel ring");o.transform.SetParent(barrel.transform);o.transform.localPosition=new Vector3(0,y,0);o.AddComponent<MeshFilter>().sharedMesh=ring;o.AddComponent<MeshRenderer>().sharedMaterial=rims;}
        // Flat compound profile: one box provides stable stacking; cylinder visuals extend only 2 cm beyond it.
        var box=barrel.AddComponent<BoxCollider>();box.size=new Vector3(.92f,1.12f,.92f);box.sharedMaterial=friction;
        var rb=barrel.AddComponent<Rigidbody>();rb.mass=DrumGame.BarrelMass;rb.linearDamping=.12f;rb.angularDamping=.22f;rb.interpolation=RigidbodyInterpolation.Interpolate;rb.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;rb.solverIterations=12;rb.solverVelocityIterations=6;
        barrel.AddComponent<DrumBarrel>();var barrelAsset=PrefabUtility.SaveAsPrefabAsset(barrel,"Assets/Prefabs/Drum.prefab");UnityEngine.Object.DestroyImmediate(barrel);
        var ball=Primitive("Weight ball",PrimitiveType.Sphere,Vector3.zero,Vector3.one*1.5f,steel);ball.GetComponent<Collider>().sharedMaterial=ballFriction;
        var br=ball.AddComponent<Rigidbody>();br.mass=DrumGame.BallMass;br.linearDamping=.07f;br.angularDamping=.14f;br.interpolation=RigidbodyInterpolation.Interpolate;br.collisionDetectionMode=CollisionDetectionMode.ContinuousDynamic;br.solverIterations=12;br.solverVelocityIterations=6;ball.AddComponent<DrumBall>();var ballAsset=PrefabUtility.SaveAsPrefabAsset(ball,"Assets/Prefabs/WeightBall.prefab");UnityEngine.Object.DestroyImmediate(ball);
        var camera=new GameObject("Main Camera").AddComponent<Camera>();camera.tag="MainCamera";camera.transform.position=new Vector3(10,8.5f,-16);camera.transform.LookAt(new Vector3(0,2,1.5f));camera.fieldOfView=43;camera.backgroundColor=new Color(.045f,.065f,.09f);camera.clearFlags=CameraClearFlags.SolidColor;camera.nearClipPlane=.1f;camera.farClipPlane=80;camera.gameObject.AddComponent<AudioListener>();
        var light=new GameObject("Key Light").AddComponent<Light>();light.type=LightType.Directional;light.intensity=1.5f;light.shadows=LightShadows.Soft;light.transform.rotation=Quaternion.Euler(42,-32,0);
        var fill=new GameObject("Warm warehouse fill").AddComponent<Light>();fill.type=LightType.Point;fill.transform.position=new Vector3(-4,6,-2);fill.range=22;fill.intensity=5;fill.color=new Color(1,.73f,.43f);
        RenderSettings.ambientLight=new Color(.32f,.38f,.45f);QualitySettings.shadowDistance=35;Time.fixedDeltaTime=.02f;Physics.defaultSolverIterations=12;
        var canvas=new GameObject("UI Canvas").AddComponent<Canvas>();canvas.renderMode=RenderMode.ScreenSpaceOverlay;
        var game=canvas.gameObject.AddComponent<DrumGame>();game.view=camera;game.barrelPrefab=barrelAsset;game.ballPrefab=ballAsset;game.guideMaterial=guide;
        // Scene contains the full initial pile for inspection before Play.
        game.contents=new GameObject("Round objects").transform;
        for(int row=0;row<5;row++)for(int col=0;col<5-row;col++)PrefabUtility.InstantiatePrefab(barrelAsset,game.contents).AsGameObject().transform.position=new Vector3((col-(4-row)*.5f)*1.02f,.56f+row*1.12f,5);
        var preview=(GameObject)PrefabUtility.InstantiatePrefab(ballAsset,game.contents);preview.transform.position=game.launchPosition;preview.GetComponent<Rigidbody>().isKinematic=true;
        EditorSceneManager.SaveScene(UnityEngine.SceneManagement.SceneManager.GetActiveScene(),"Assets/Scenes/DrumSmash.unity");EditorBuildSettings.scenes=new[]{new EditorBuildSettingsScene("Assets/Scenes/DrumSmash.unity",true)};
        PlayerSettings.companyName="Local Lab";PlayerSettings.productName="Drum Smash";PlayerSettings.defaultWebScreenWidth=1200;PlayerSettings.defaultWebScreenHeight=720;PlayerSettings.runInBackground=true;
        AssetDatabase.SaveAssets();Application.logMessageReceived+=LogError;playStart=EditorApplication.timeSinceStartup;EditorApplication.update+=BeginPlay;
    }
    static void BeginPlay(){if(EditorApplication.timeSinceStartup-playStart<5||EditorApplication.isCompiling||EditorApplication.isUpdating)return;EditorApplication.update-=BeginPlay;SessionState.SetBool("DrumTesting",true);EditorApplication.update+=Test;EditorApplication.EnterPlaymode();}
    static GameObject AsGameObject(this UnityEngine.Object obj) => (GameObject)obj;
    static void Capture(string name,DrumGame g){var rt=new RenderTexture(1200,720,24);g.view.targetTexture=rt;g.view.Render();RenderTexture.active=rt;var tex=new Texture2D(1200,720,TextureFormat.RGB24,false);tex.ReadPixels(new Rect(0,0,1200,720),0,0);tex.Apply();File.WriteAllBytes(Path.Combine(Evidence,name+".png"),tex.EncodeToPNG());g.view.targetTexture=null;RenderTexture.active=null;UnityEngine.Object.DestroyImmediate(tex);UnityEngine.Object.DestroyImmediate(rt);}
    static void Test(){
        if(!EditorApplication.isPlaying)return;var g=UnityEngine.Object.FindAnyObjectByType<DrumGame>();if(!g||g.barrels.Count!=15)return;
        float now=Time.timeSinceLevelLoad;
        if(phase==0 && now>8){stable=g.fallen==0 && g.maxBarrelSpeed<1;Capture("editor-start",g);checks.Add("Initial 8s: "+JsonUtility.ToJson(g.Sample()));phase=1;at=now;direction=g.DragVelocity(new Vector2(-150,240)).x>0 && g.DragVelocity(new Vector2(150,240)).x<0;g.Launch(new Vector3(0,4.4f,20));blocked=!g.Launch(new Vector3(0,4,20));}
        else if(phase==1){
            if(g.state=="CLEAR" && now-at>9 || now-at>32){natural=g.Sample();clear=g.fallen>=12;Capture("editor-impact-result",g);checks.Add("Natural shots: "+JsonUtility.ToJson(natural));var b=g.barrels.Find(x=>x.counted);if(b){b.transform.rotation=Quaternion.identity;b.transform.rotation=Quaternion.Euler(80,0,0);}phase=2;at=now;}
            else if(g.ready){g.Launch(new Vector3(g.shots==1?-1.4f:1.4f,4.4f,20));}
        }
        else if(phase==2 && now-at>.5f){dedup=g.fallen==natural.fallen;g.Retry();retry=g.shots==0&&g.fallen==0&&g.combo==0&&g.impacts==0&&g.ready&&g.barrels.Count==15;phase=3;at=now;}
        else if(phase==3 && now-at>3){if(g.ready && misses<3){g.Launch(new Vector3(15,2,10));misses++;}if(g.state=="GAME OVER"||now-at>65){over=g.state=="GAME OVER"&&g.shots==3&&g.fallen<12;checks.Add("Misses: "+JsonUtility.ToJson(g.Sample()));Capture("editor-misses",g);Finish();}}
    }
    static void Finish(){var result=new {passed=stable&&blocked&&clear&&over&&dedup&&retry&&direction&&errors==0,stable,blocked,clear,over,dedup,retry,direction,consoleErrors=errors,natural,checks};File.WriteAllText(Path.Combine(Evidence,"editor-tests.json"),JsonUtility.ToJson(new TestResult{passed=result.passed,stable=stable,blocked=blocked,clear=clear,gameOver=over,dedup=dedup,retry=retry,direction=direction,consoleErrors=errors,natural=natural,observations=checks.ToArray()},true));Debug.Log("DRUM_TEST_RESULT "+File.ReadAllText(Path.Combine(Evidence,"editor-tests.json")));SessionState.SetBool("DrumTesting",false);EditorApplication.update-=Test;EditorApplication.Exit(result.passed?0:1);}
    [Serializable] class TestResult{public bool passed,stable,blocked,clear,gameOver,dedup,retry,direction;public int consoleErrors;public DrumGame.Snapshot natural;public string[] observations;}
    public static void BuildWeb(){Directory.CreateDirectory(Evidence);PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;PlayerSettings.WebGL.template="APPLICATION:Default";PlayerSettings.WebGL.initialMemorySize=128;var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Scenes/DrumSmash.unity"},locationPathName="Build/Web",target=BuildTarget.WebGL,options=BuildOptions.None});File.WriteAllText(Path.Combine(Evidence,"web-build.json"),"{\"result\":\""+report.summary.result+"\",\"errors\":"+report.summary.totalErrors+",\"warnings\":"+report.summary.totalWarnings+",\"bytes\":"+report.summary.totalSize+",\"seconds\":"+report.summary.totalTime.TotalSeconds.ToString(System.Globalization.CultureInfo.InvariantCulture)+"}");if(report.summary.result!=BuildResult.Succeeded)throw new Exception("Web build failed");}
}
