import { mount } from 'svelte';
import '../styles/base.css';
import Popup from './Popup.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app');

mount(Popup, { target });
