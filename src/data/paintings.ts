import pandemonium from '../assets/pandemonium.jpg';
import babylon from '../assets/babylon.jpg';
import moon from '../assets/moon.jpg';
export const paintings = [
 {title:'Pandemonium',artist:'John Martin',year:'1841',image:pandemonium,source:'Wikimedia Commons · Musée du Louvre',rights:'Public domain',file:'Le Pandemonium - John Martin - Musée du Louvre Peintures RF 2006 21.jpg',note:'Oil on canvas. A palace built on the edge of the impossible.'},
 {title:'The Fall of Babylon',artist:'John Martin',year:'1831',image:babylon,source:'Wellcome Collection / Wikimedia Commons',rights:'Wellcome Collection · CC BY 4.0',file:'The fall of Babylon; Cyrus the Great defeating the Chaldean Wellcome V0034440.jpg',note:'Hand-coloured mezzotint after the 1819 painting. This study uses the print, not a photograph of the original painting.'},
 {title:'A Wet Moon, Putney Road',artist:'John Atkinson Grimshaw',year:'1886',image:moon,source:'Wikimedia Commons · private collection',rights:'Public domain',file:'John Atkinson Grimshaw - A Wet Moon, Putney Road (1886).jpg',note:'Oil on canvas. Moonlight, wet pavement, and the last light in a window.'}
].map(p=>({...p,original:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(p.file),license:p.rights.includes('CC BY')?'https://creativecommons.org/licenses/by/4.0/':'https://creativecommons.org/publicdomain/mark/1.0/'}));
