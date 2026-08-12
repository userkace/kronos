import { Reorder, useDragControls } from 'framer-motion';
import {
  PanelLeft, GripVertical, ChevronUp, ChevronDown, Eye, EyeOff, RotateCcw, Lock,
} from 'lucide-react';
import { useSidebarItems } from '../hooks/useSidebarItems';
import { useMotionPreferences } from '../hooks/useMotionPreferences';

// One row of the editor. Split out because each draggable row needs its own
// useDragControls instance, and because dragListener={false} + a handle-only
// drag is what keeps the eye/arrow buttons clickable instead of every press
// turning into a drag.
const SidebarItemRow = ({ item, hidden, isFirst, isLast, onMove, onToggle, transition }) => {
  const dragControls = useDragControls();
  const Icon = item.icon;
  const locked = Boolean(item.locked);

  return (
    <Reorder.Item
      value={item.id}
      dragListener={false}
      dragControls={dragControls}
      transition={transition}
      className={`flex select-none items-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-2 shadow-xs ${
        hidden ? 'opacity-60' : ''
      }`}
    >
      {/* Pointer-only affordance, deliberately not focusable: keyboard users
          reorder with the arrow buttons, so a focus stop here would just be a
          control that does nothing when you press it. */}
      <span
        onPointerDown={(e) => dragControls.start(e)}
        aria-hidden="true"
        title="Drag to reorder"
        className="shrink-0 cursor-grab touch-none rounded-lg p-1 text-gray-300 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
      >
        <GripVertical className="h-4 w-4" />
      </span>

      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gray-100 text-gray-500">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-gray-900">{item.label}</span>
          {locked && (
            <span
              title="Settings can't be hidden — it's how you get back here"
              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-500"
            >
              <Lock className="h-2.5 w-2.5" />
              Always on
            </span>
          )}
        </div>
        <p className="truncate text-xs text-gray-400">
          {hidden ? 'Hidden from the sidebar' : item.description}
        </p>
      </div>

      {/* Keyboard/pointer alternative to dragging — the handle alone would
          leave reordering unreachable without a mouse. */}
      <div className="flex shrink-0 items-center">
        <button
          type="button"
          onClick={() => onMove(item.id, -1)}
          disabled={isFirst}
          aria-label={`Move ${item.label} up`}
          className="rounded-lg p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => onMove(item.id, 1)}
          disabled={isLast}
          aria-label={`Move ${item.label} down`}
          className="rounded-lg p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronDown className="h-4 w-4" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => onToggle(item.id)}
        disabled={locked}
        aria-pressed={!hidden}
        aria-label={hidden ? `Show ${item.label} in the sidebar` : `Hide ${item.label} from the sidebar`}
        title={locked ? "Settings can't be hidden" : hidden ? 'Show in sidebar' : 'Hide from sidebar'}
        className={`ml-0.5 shrink-0 rounded-lg p-1.5 transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 ${
          hidden
            ? 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
        }`}
      >
        {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </Reorder.Item>
  );
};

/**
 * Settings → Sidebar Items. Reorders and hides the sidebar's navigation
 * entries; changes apply to the sidebar rendered around this page immediately
 * (both read the same useSidebarItems state) and persist on this device only.
 */
const SidebarItemsSettings = () => {
  const {
    orderedItems, order, isHidden, hiddenCount, totalCount,
    isCustomized, setOrder, moveItem, toggleItem, resetLayout,
  } = useSidebarItems();
  const { shouldReduceMotion } = useMotionPreferences();

  // Reorder.Item animates its position with a spring by default; collapse that
  // to an instant swap when the device or the user asks for less motion.
  const transition = shouldReduceMotion
    ? { duration: 0 }
    : { type: 'spring', stiffness: 600, damping: 40 };

  return (
    <div className="bg-white border border-gray-200/80 rounded-2xl shadow-xs p-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-purple-50 text-purple-600">
          <PanelLeft className="w-[18px] h-[18px]" />
        </div>
        <div>
          <h4 className="text-base font-semibold text-gray-900 tracking-tight">Sidebar Items</h4>
          <p className="text-[13px] text-gray-500">
            Drag to reorder, or hide the views you don't use. Saved on this device.
          </p>
        </div>
      </div>

      <Reorder.Group axis="y" values={order} onReorder={setOrder} className="space-y-2">
        {orderedItems.map((item, index) => (
          <SidebarItemRow
            key={item.id}
            item={item}
            hidden={isHidden(item.id)}
            isFirst={index === 0}
            isLast={index === orderedItems.length - 1}
            onMove={moveItem}
            onToggle={toggleItem}
            transition={transition}
          />
        ))}
      </Reorder.Group>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-gray-100 pt-3">
        <p className="text-xs text-gray-400">
          {hiddenCount === 0
            ? `All ${totalCount} items shown.`
            : `${hiddenCount} of ${totalCount} items hidden. Hiding a view doesn't delete any data.`}
        </p>
        <button
          type="button"
          onClick={resetLayout}
          disabled={!isCustomized}
          className="flex shrink-0 items-center gap-1 text-xs font-medium text-gray-500 transition-colors duration-150 hover:text-gray-700 disabled:pointer-events-none disabled:opacity-40"
        >
          <RotateCcw className="w-3 h-3" />
          Reset to default
        </button>
      </div>
    </div>
  );
};

export default SidebarItemsSettings;
