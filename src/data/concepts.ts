export const concepts = [
 ['immersion','Nothing between','The painting is the whole site. Crossfade between worlds; summon the details only when you want them.','Use arrows to change paintings.'],
 ['reveal','From a whisper','Begin inside a tiny detail. A slow pullback reveals the scale of the whole painting.','Press Reveal to pull back.'],
 ['descent','Into the painting','Your scroll controls the distance. Move from the whole composition into its architecture.','Scroll or drag the distance slider.'],
 ['aperture','An opening','A small circular window expands until the painting takes over the screen.','Press Open to expand the window.'],
 ['diptych','Two worlds','Two paintings share a screen. Drag the seam to decide which world takes over.','Drag the seam or use the slider.'],
 ['contact','Collected fragments','An asymmetric composition of three works. Pick one and everything else falls away.','Select a painting to look closer.'],
 ['index','Only the names','A quiet typographic index. The painting appears behind the title you touch or focus.','Hover, focus, or tap a title.'],
 ['filmstrip','Passing through','A horizontal ribbon of paintings. Move along it like a strip of still cinema.','Scroll sideways or use the arrows.'],
 ['spotlight','A light in the dark','Explore a shadowed painting with a pool of light, then turn the lights all the way up.','Move your pointer; tap Illuminate for the whole work.'],
 ['loupe','Look closer','The whole work stays in view while a movable lens reveals its small details.','Move over the painting to move the lens.'],
 ['shutters','Between the lines','Three tall slivers of three different worlds. Select a sliver and let it unfold.','Select a panel to unfold it.'],
 ['horizon','A little distance','An almost empty canvas. A narrow horizon grows into a full painting on demand.','Press Unfold to reveal the composition.']
].map(([slug,title,description,hint],i)=>({slug,title,description,hint,number:String(i+1).padStart(2,'0')}));
