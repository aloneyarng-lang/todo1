const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="5" transform="rotate(-35 12 12)"/><path d="M9 3a10 10 0 0 1 8 17"/>',
  library: '<path d="M4 4h4v16H4zM11 4h4v16h-4zM17 4l4-1 4 16-4 1z" transform="translate(-1 0) scale(.95 1)"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2L12 17.3l-5.6 2.9 1.1-6.2L3 9.6l6.2-.9z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  folder: '<path d="M3 7V5h6l2 2h10v12H3z"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7h.01"/>',
  settings: '<path d="m9 3-.6 2.1-2 .9-2-.5L2 9l1.6 1.6v2.8L2 15l2.4 3.5 2-.5 2 .9L9 21h5l.6-2.1 2-.9 2 .5L21 15l-1.6-1.6v-2.8L21 9l-2.4-3.5-2 .5-2-.9L14 3z"/><circle cx="11.5" cy="12" r="3"/>',
  home: '<path d="m3 10 9-7 9 7v10h-7v-6h-4v6H3z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.6 8.5a2.6 2.6 0 1 1 4.1 2.1c-1.5.8-1.7 1.4-1.7 2.4M12 17h.01"/>',
  download: '<path d="M12 3v12m-5-5 5 5 5-5M4 15v5h16v-5"/>',
  upload: '<path d="M12 16V4m-5 5 5-5 5 5M4 16v4h16v-4"/>',
  files: '<path d="M7 3h8l4 4v14H7zM15 3v5h4M3 7v13M10 12h6M10 16h6"/>',
  tag: '<path d="M3 3h8l10 10-8 8L3 11z"/><circle cx="7.5" cy="7.5" r="1"/>',
  network: '<circle cx="5" cy="5" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="8" cy="18" r="2"/><circle cx="20" cy="18" r="2"/><path d="m7 5 9 1M6 7l2 9m2 2h8M17 8l-7 8m9-8 1 8"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  sliders: '<path d="M3 6h5m4 0h9M3 12h11m4 0h3M3 18h3m4 0h11"/><circle cx="10" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="8" cy="18" r="2"/>',
  'chevron-down': '<path d="m7 9 5 5 5-5"/>', expand: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  mouse: '<rect x="6" y="2" width="12" height="20" rx="6"/><path d="M12 6v4"/>',
  external: '<path d="M14 3h7v7m0-7L10 14M9 3H3v18h18v-6"/>',
  edit: '<path d="m15 4 5 5M3 21l5-1L21 7l-5-5L3 15z"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>', check: '<path d="m5 12 4 4L19 6"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
};
Object.assign(icons, {'panel-left':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>','panel-right':'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16"/>',chart:'<path d="M4 3v17h17M7 15l4-5 4 2 5-7"/>',table:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',ruler:'<path d="m3 16 13-13 5 5L8 21zM7 12l2 2m2-6 2 2m2-6 2 2"/>',eye:'<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>','eye-off':'<path d="m3 3 18 18M8 6a12 12 0 0 1 4-1c6 0 10 7 10 7a18 18 0 0 1-4 4M6 8a20 20 0 0 0-4 4s4 7 10 7a12 12 0 0 0 4-1"/>',overview:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',undo:'<path d="M4 10h10a6 6 0 1 1 0 12M4 10l5-5m-5 5 5 5"/>',local:'<circle cx="12" cy="12" r="3"/><circle cx="4" cy="5" r="2"/><circle cx="20" cy="5" r="2"/><circle cx="20" cy="19" r="2"/><path d="m6 6 4 4m4 0 4-4m-4 8 4 4"/>'});
icons.palette='<path d="M12 3a9 9 0 1 0 0 18h1.2a2 2 0 0 0 1.2-3.6 1.7 1.7 0 0 1 1-3.1H18a3 3 0 0 0 3-3A8.9 8.9 0 0 0 12 3Z"/><circle cx="7" cy="10" r=".8"/><circle cx="10" cy="6.8" r=".8"/><circle cx="15" cy="7.5" r=".8"/>';
Object.assign(icons,{
 swap:'<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 assistant:'<path d="M21 12v4a3 3 0 0 1-3 3H8l-5 3V6a3 3 0 0 1 3-3h5"/><path d="m17 2 1.3 3.7L22 7l-3.7 1.3L17 12l-1.3-3.7L12 7l3.7-1.3Z"/>',
 text:'<path d="M4 5h16M12 5v15M8 20h8"/>',
 area:'<rect x="4" y="4" width="16" height="16" rx="2" stroke-dasharray="3 3"/>',
 'arrow-diagonal':'<path d="M5 19 19 5M8 5h11v11"/>',
 cursor:'<path d="m5 3 15 10-7 1-4 7Z"/>',
 image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-6-6L3 21"/>',
 'chevron-left':'<path d="m15 5-7 7 7 7"/>',
 'chevron-right':'<path d="m9 5 7 7-7 7"/>'
});
export const icon = name => `<svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name] || icons.files}</svg>`;

export function hydrateIcons(root=document){root.querySelectorAll('[data-icon]').forEach(node=>{node.innerHTML=icon(node.dataset.icon);});}
