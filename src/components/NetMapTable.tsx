import type { Component } from 'solid-js';
import { createSignal, For } from 'solid-js';
import { createStore, type SetStoreFunction } from 'solid-js/store';

export interface NetMapTableItem {
  pad: string;
  netNow: string;
  netWant: string;
}

export interface NetMapTableStore {
  items: NetMapTableItem[];
  setItems: SetStoreFunction<NetMapTableItem[]>;
}

const NetMapTable: Component = () => {
  const [items, setItems] = createStore<NetMapTableItem[]>([]);

  // Expose the store globally for non-Solid JS usage
  const netMapTableStore: NetMapTableStore = {
    items,
    setItems,
  };
  (window as any).netMapTableStore = netMapTableStore;

  return (
    <table class="table-auto border-collapse border border-gray-700 w-full text-sm text-left">
      <thead class="bg-gray-800">
        <tr>
          <th class="border border-gray-700 px-3 py-2 text-gray-100">KiCad Pad Number</th>
          <th class="border border-gray-700 px-3 py-2 text-gray-100">Ergogen Net Name</th>
        </tr>
      </thead>
      <tbody>
        <For each={items}>
          {(item, i) => (
            <tr class="hover:bg-gray-700">
              <td class="border border-gray-700 px-3 py-1 text-gray-100">{item.pad}</td>
              <td class="border border-gray-700 px-3 py-1">
                <input
                  class="w-full px-2 py-1 border border-gray-600 rounded bg-gray-800 text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  type="text"
                  placeholder={item.netNow}
                  value={item.netWant}
                  onBlur={(e) => {
                    const newValue = e.currentTarget.value.trim();
                    if (newValue !== item.netNow) {
                      setItems(i(), 'netWant', newValue);

                      (window as any)?.debouncedParse();
                    }
                  }}
                />
              </td>
            </tr>
          )}
        </For>
      </tbody>
    </table>
  );
};

export default NetMapTable;
