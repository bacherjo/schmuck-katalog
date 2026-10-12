// Photo zoom for images with class "zoomable".
// Mouse: hovering magnifies the photo at the cursor and follows it.
// Touch / pen: tap to zoom in at that spot, drag to move around the enlarged photo,
// tap again (without dragging) to zoom out.
(function(){
  "use strict";
  const SCALE=2.5, TAP_SLOP=8;   // finger movement (px) still counted as a tap
  const find=t=>t&&t.closest?t.closest("img.zoomable"):null;
  const clamp=v=>Math.min(1,Math.max(0,v));
  // The photo fills its frame, so measure the (unscaled) frame, not the scaled image.
  const frame=img=>(img.parentElement||img).getBoundingClientRect();
  function setOrigin(img,fx,fy){
    img.dataset.ox=fx; img.dataset.oy=fy;
    img.style.transformOrigin=(fx*100)+"% "+(fy*100)+"%";
  }
  function originAt(img,e){const r=frame(img);setOrigin(img,clamp((e.clientX-r.left)/r.width),clamp((e.clientY-r.top)/r.height));}
  function zoomIn(img,e){originAt(img,e);img.style.transform="scale("+SCALE+")";img.classList.add("zoomed");}
  function zoomOut(img){img.style.transform="";img.classList.remove("zoomed","panning");}

  /* ---- mouse: hover magnifier ---- */
  document.addEventListener("pointermove",e=>{
    if(e.pointerType!=="mouse") return;
    const img=find(e.target); if(img) zoomIn(img,e);
  });
  document.addEventListener("pointerout",e=>{
    if(e.pointerType!=="mouse") return;
    const img=find(e.target); if(!img) return;
    if(e.relatedTarget&&img.contains(e.relatedTarget)) return;
    zoomOut(img);
  });

  /* ---- touch / pen: tap to zoom, drag to pan ---- */
  let drag=null; // {img, id, x, y, ox, oy, moved, wasZoomed}
  document.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse") return;
    const img=find(e.target); if(!img) return;
    const zoomed=img.classList.contains("zoomed");
    drag={img,id:e.pointerId,x:e.clientX,y:e.clientY,ox:+img.dataset.ox||0.5,oy:+img.dataset.oy||0.5,moved:false,wasZoomed:zoomed};
    if(zoomed){ try{img.setPointerCapture(e.pointerId);}catch(_){} }
  });
  document.addEventListener("pointermove",e=>{
    if(!drag||e.pointerId!==drag.id) return;
    const dx=e.clientX-drag.x, dy=e.clientY-drag.y;
    if(!drag.moved&&Math.hypot(dx,dy)>TAP_SLOP) drag.moved=true;
    if(!drag.wasZoomed||!drag.moved) return;
    e.preventDefault();
    // Dragging the finger moves the photo with it: shift the zoom origin the opposite way.
    const r=frame(drag.img);
    drag.img.classList.add("panning");
    setOrigin(drag.img,clamp(drag.ox-dx/(r.width*(SCALE-1))),clamp(drag.oy-dy/(r.height*(SCALE-1))));
  },{passive:false});
  function end(e){
    if(!drag||e.pointerId!==drag.id) return;
    const {img,moved,wasZoomed}=drag; drag=null;
    img.classList.remove("panning");
    if(e.type==="pointercancel"||moved) return;   // a drag or a page scroll, not a tap
    if(wasZoomed) zoomOut(img); else zoomIn(img,e);
  }
  document.addEventListener("pointerup",end);
  document.addEventListener("pointercancel",end);
})();
