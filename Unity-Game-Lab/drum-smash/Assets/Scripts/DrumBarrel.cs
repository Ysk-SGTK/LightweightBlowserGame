using UnityEngine;
public class DrumBarrel : MonoBehaviour {
    [HideInInspector] public DrumGame game;
    [HideInInspector] public Rigidbody body;
    public bool counted;
    void Awake(){body=GetComponent<Rigidbody>();}
    void FixedUpdate(){if(game && !counted && (Vector3.Angle(transform.up,Vector3.up)>48 || transform.position.y<-.5f || Mathf.Abs(transform.position.x)>9 || transform.position.z>10 || transform.position.z< -11)) {
        counted=true;game.Knocked(this);
    }}
}
