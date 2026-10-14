import test from 'node:test';
import assert from 'node:assert/strict';
import {events,filterEvents,escapeHtml} from '../dist/data.js';
test('busca combina região e categoria sem diferenciar acentos',()=>{assert.equal(filterEvents(events,{q:'educacao',region:'Online'})[0].id,'eduhack');assert.equal(filterEvents(events,{category:'Educação',region:'Fortaleza'}).length,0)});
test('busca inclui habilidades e suporta ausência de resultados',()=>{assert.equal(filterEvents(events,{q:'Python'}).length,1);assert.equal(filterEvents(events,{q:'inexistente'}).length,0)});
test('conteúdo do perfil é escapado antes de inserir no HTML',()=>{assert.equal(escapeHtml('<img onerror="x">'), '&lt;img onerror=&quot;x&quot;&gt;')});
test('cada evento possui rota e foto próprias',()=>{assert.equal(new Set(events.map(e=>e.id)).size,events.length);assert.ok(events.every(e=>Number.isInteger(e.img)&&e.source.endsWith('.example')))});
