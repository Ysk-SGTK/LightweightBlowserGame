using UnityEngine;
public class DrumBall : MonoBehaviour {
    [HideInInspector] public DrumGame game;
    void OnCollisionEnter(Collision c){if(game && c.gameObject.GetComponent<DrumBarrel>() && c.contactCount>0)game.Impact(c.GetContact(0).point,c.relativeVelocity.magnitude);}
}
