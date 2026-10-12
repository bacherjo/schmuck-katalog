// Photo zoom for images with class "zoomable".
// Mouse: hovering magnifies the photo at the cursor and follows it.
// Touch / pen: a tap zooms in at that spot, a second tap zooms out.
(function(){
  "use strict";
  const SCALE=2.5;
  const find=t=>t&&t.closest?t.closest("img.zoomable"):null;
  // The photo fills its frame, so measure the (unscaled) frame, not the scaled image.
  function originAt(img,e){
    const r=(img.parentElement||img).getBoundingClientRect();
    const x=Math.min(100,Math.max(0,(e.clientX-r.left)/r.width*100));
    const y=Math.min(100,Math.max(0,(e.clientY-r.top)/r.height*100));
    img.style.transformOrigin=x+"% "+y+"%";
  }
  function zoomIn(img,e){originAt(img,e);img.style.transform="scale("+SCALE+")";img.classList.add("zoomed");}
  function zoomOut(img){img.style.transform="";img.classList.remove("zoomed");}

  document.addEventListener("pointermove",e=>{
    if(e.pointerType!=="mouse") return;
    const img=find(e.target); if(!img) return;
    zoomIn(img,e);
  });
  document.addEventListener("pointerout",e=>{
    if(e.pointerType!=="mouse") return;
    const img=find(e.target); if(!img) return;
    if(e.relatedTarget&&img.contains(e.relatedTarget)) return;
    zoomOut(img);
  });
  document.addEventListener("pointerup",e=>{
    if(e.pointerType==="mouse") return;
    const img=find(e.target); if(!img) return;
    if(img.classList.contains("zoomed")) zoomOut(img); else zoomIn(img,e);
  });
})();
