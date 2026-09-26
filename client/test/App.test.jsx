// Component interaction tests; backend and optimizer are tested separately.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import { api } from '../src/api.js';
vi.mock('../src/api.js', () => ({ api: vi.fn() }));
const fixture = (role='manager') => ({name:'Test neighborhood',revision:0,me:{id:role==='manager'?'m':'a',name:'Test User',role},config:{timezone:'America/New_York',maxHours:20,targetHours:10,maxContinuousHours:6,minRestHours:8,allowedShiftHours:[2,4,6],openHours:[{day:1,start:480,end:720}]},members:[{id:'m',name:'Manager',role:'manager',availability:[],exceptions:[]},{id:'a',name:'Alex',role:'da',email:'alex@test.example',availability:[],exceptions:[],nightPreference:false}],plans:{}});
afterEach(()=>{cleanup();vi.resetAllMocks();});
describe('main user flows',()=>{
 it('logs in and renders manager planning controls',async()=>{
  const user=userEvent.setup();
  api.mockRejectedValueOnce(new Error('Please sign in')).mockResolvedValueOnce({ok:true}).mockResolvedValueOnce(fixture());
  render(<App/>);
  await user.type(await screen.findByLabelText('Email'),'manager@test.example');
  await user.type(screen.getByLabelText('Password'),'some-test-password');
  await user.click(screen.getByRole('button',{name:'Sign in',exact:true}));
  await screen.findByRole('heading',{name:'Build a better week.'});
  expect(api).toHaveBeenCalledWith('/login','POST',{email:'manager@test.example',password:'some-test-password'});
  expect(screen.getByRole('button',{name:/Create blocks for all/})).toBeTruthy();
 });
 it('DA saves availability and night preference without manager controls',async()=>{
  const user=userEvent.setup();api.mockResolvedValue(fixture('da'));render(<App/>);
  await user.click(await screen.findByRole('button',{name:'Availability',exact:true}));
  await user.click(screen.getByRole('button',{name:'Add window'}));
  await user.click(screen.getByRole('checkbox',{name:/I prefer night shifts/}));
  await user.click(screen.getByRole('button',{name:'Save availability'}));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/availability','PUT',expect.objectContaining({revision:0,nightPreference:true,availability:[{day:1,start:480,end:1080}]})));
  expect(screen.queryByRole('button',{name:'Rules',exact:true})).toBeNull();
 });
 it('surfaces rejected save and lets the user refresh',async()=>{
  const user=userEvent.setup();api.mockResolvedValueOnce(fixture()).mockRejectedValueOnce(new Error('Someone changed this neighborhood. Refresh and try again.')).mockResolvedValue(fixture());
  render(<App/>);await user.click(await screen.findByRole('button',{name:/Create blocks for all/}));
  expect((await screen.findByRole('alert')).textContent).toContain('Someone changed');
  await user.click(screen.getByRole('button',{name:'Refresh',exact:true}));
  await waitFor(()=>expect(screen.queryByRole('alert')).toBeNull());
 });
});
