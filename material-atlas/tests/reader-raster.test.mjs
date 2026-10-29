import test from 'node:test';
import assert from 'node:assert/strict';
import {readerRasterPlan,READER_RASTER_PIXEL_LIMIT} from '../dist/reader-layout.js';

test('PDF raster uses extra samples on standard and high density screens without changing page geometry',()=>{
  const viewport={width:800.25,height:1100.75};
  const normal=readerRasterPlan([viewport],1)[0],retina=readerRasterPlan([viewport],2)[0],dense=readerRasterPlan([viewport],3)[0];
  assert.ok(normal.width>=1600);assert.ok(retina.width>normal.width);assert.ok(dense.width>retina.width);
  for(const p of [normal,retina,dense]){assert.ok(Number.isInteger(p.width)&&Number.isInteger(p.height));assert.equal(viewport.width*p.scaleX,p.width);assert.equal(viewport.height*p.scaleY,p.height);}
  assert.deepEqual(viewport,{width:800.25,height:1100.75});assert.deepEqual(readerRasterPlan([viewport],NaN),[normal]);
});

test('large zoom and two-page spreads share a bounded pixel budget and respect maximum canvas dimensions',()=>{
  for(const pages of [[{width:1800,height:2500}],[{width:1800,height:2500},{width:1800,height:2500}],[{width:500,height:15000}]]){
    const raster=readerRasterPlan(pages,4);assert.ok(raster.reduce((sum,p)=>sum+p.width*p.height,0)<=READER_RASTER_PIXEL_LIMIT);
    for(const p of raster){assert.ok(p.width>0&&p.height>0);assert.ok(p.width<=8192&&p.height<=8192);}
  }
  for(const pages of [[],[{width:Infinity,height:100}],[{width:0,height:100}],[{width:100,height:-1}]])assert.throws(()=>readerRasterPlan(pages));
});
