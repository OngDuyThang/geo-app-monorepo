<script lang="ts">
  import { hc } from 'hono/client';
  import { onMount } from 'svelte';
  import type { AppType } from '../../hono-api/src/index';
 
  // @ts-ignore

  // RPC Client with Hono controllers type safe
  const client = hc<AppType>(process?.env?.HONO_API_URL || 'http://localhost:8787');

  // Theme State (Default Dark)
  let theme = 'dark';

  // Reactively update HTML class when theme changes
  $: {
    if (typeof document !== 'undefined') {
      const html = document.documentElement;
      if (theme === 'dark') {
        html.classList.add('dark');
      } else {
        html.classList.remove('dark');
      }
    }
  }

  // Data State
  let address = "Locating...";
  let groups = [
    { id: 'circle-k', title: 'Circle K', color: 'red', data: [], loading: true, count: 0 },
    { id: 'family-mart', title: 'FamilyMart', color: 'blue', data: [], loading: true, count: 0 },
    { id: 'others', title: 'Others', color: 'emerald', data: [], loading: true, count: 0 }
  ] as any;

  async function fetchLocation() {
    try {
      const res = await client.index.$get();
      const data = await res.json();
      address = data.formatted_address || "Location found";
    } catch (e) {
      address = "Unable to locate";
    }
  }

  async function fetchGroup(index: number, type: 'circle-k' | 'family-mart' | 'others') {
    groups[index].loading = true;
    groups[index].data = []; 
    try {
      // @ts-ignore
      const res = await client.stores[type].$get();
      const data = await res.json();
      
      if (data.found) {
        groups[index].data = data.stores;
        groups[index].count = data.count;
      } else {
        groups[index].count = 0;
      }
    } catch (e) {
      console.error(e);
      groups[index].count = 0;
    } finally {
      groups[index].loading = false;
    }
  }

  onMount(() => {
    fetchLocation();
    fetchGroup(0, 'circle-k');
    fetchGroup(1, 'family-mart');
    fetchGroup(2, 'others');
  });

  function openMap(lat: number, lon: number) {
    window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, '_blank');
  }
</script>

<div class="min-h-screen transition-colors duration-300 bg-slate-50 text-slate-800 dark:bg-slate-900 dark:text-slate-100 font-sans">
  
  <main class="max-w-7xl mx-auto p-4 md:p-8">
    <header class="mb-8 flex flex-col gap-4">
      
      <div class="flex items-center justify-between w-full">
        <h1 class="text-xl font-bold text-gray-900 dark:text-white">🏪 Convenience Store Finder</h1>
        
        <select 
          bind:value={theme} 
          class="px-4 py-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg text-sm text-gray-700 dark:text-gray-200 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
        >
          <option value="light">☀️ Light</option>
          <option value="dark">🌙 Dark</option>
        </select>
      </div>

      <div class="flex items-center gap-3 px-5 py-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-sm w-full text-gray-700 dark:text-gray-200">
        <span class="text-xl">📍</span>
        <div class="flex flex-col">
          <span class="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wide">Current Location</span>
          <span class="font-medium text-xs leading-tight">{address}</span>
        </div>
      </div>

    </header>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#each groups as group, i}
        <section class="flex flex-col gap-4">
          <div class="flex items-center justify-between pb-2 border-b-2" 
               style="border-color: {group.color === 'emerald' ? '#10b981' : group.color === 'blue' ? '#3b82f6' : '#ef4444'};">
            <h2 class="text-xl font-bold text-gray-800 dark:text-gray-100">{group.title}</h2>
            
            <div class="flex items-center gap-2">
              <button 
                onclick={() => fetchGroup(i, group.id as any)}
                class="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
                title="Refresh list"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20"/></svg>
              </button>
              <span class="text-xs px-2 py-1 rounded-full font-bold bg-gray-100 dark:bg-slate-800 text-gray-600 dark:text-gray-300">
                {group.loading ? '...' : group.count}
              </span>
            </div>
          </div>

          {#if group.loading}
            <div class="animate-pulse h-24 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
            <div class="animate-pulse h-24 bg-gray-200 dark:bg-slate-800 rounded-lg"></div>
          
          {:else if group.data.length === 0}
            <div class="flex flex-col items-center justify-center p-6 text-center text-gray-400 dark:text-gray-500 bg-white dark:bg-slate-800 rounded-lg border border-dashed border-gray-300 dark:border-slate-700 gap-3">
              <span class="text-sm">No stores found</span>
              <button 
                onclick={() => fetchGroup(i, group.id as any)}
                class="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-600 transition-colors flex items-center gap-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><!-- Icon from Material Symbols by Google - https://github.com/google/material-design-icons/blob/master/LICENSE --><path fill="currentColor" d="M12 20q-3.35 0-5.675-2.325T4 12t2.325-5.675T12 4q1.725 0 3.3.712T18 6.75V4h2v7h-7V9h4.2q-.8-1.4-2.187-2.2T12 6Q9.5 6 7.75 7.75T6 12t1.75 4.25T12 18q1.925 0 3.475-1.1T17.65 14h2.1q-.7 2.65-2.85 4.325T12 20"/></svg>
                Try Again
              </button>
            </div>

          {:else}
            {#each group.data as store}
              <div 
                class="relative bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 cursor-pointer hover:shadow-md dark:hover:border-slate-600 transition-all group overflow-hidden"
                role="button"
                tabindex="0"
                onclick={() => openMap(store.coordinates.lat, store.coordinates.lon)}
              >
                <div class="absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-bold text-white shadow-sm"
                     style="background-color: {group.color === 'emerald' ? '#10b981' : group.color === 'blue' ? '#3b82f6' : '#ef4444'};">
                  {store.distance_km} km
                </div>

                <h3 class="font-bold text-gray-800 dark:text-gray-200 pr-12">{store.name}</h3>
                <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{store.address}</p>
                
                <div class="mt-3 text-xs text-gray-400 dark:text-gray-500 font-medium uppercase tracking-wide flex items-center gap-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                  Navigate <span>↗</span>
                </div>
              </div>
            {/each}
          {/if}
        </section>
      {/each}
    </div>
  </main>
</div>