export default {
  // page tabs
  'tags.tab.dictionary': '标签字典',
  'tags.tab.bulk':       '批量打标',

  // dictionary table
  'tags.col.id':           'ID',
  'tags.col.slug':         'Slug',
  'tags.col.displayName':  '显示名',
  'tags.col.sortOrder':    '排序',
  'tags.col.active':       '上线',
  'tags.col.pinned':       '置顶',
  'tags.col.refCount':     '关联事件数',
  'tags.col.actions':      '操作',

  // buttons + modals
  'tags.btn.new':       '新建标签',
  'tags.btn.edit':      '编辑',
  'tags.btn.delete':    '删除',
  'tags.btn.create':    '创建',
  'tags.btn.save':      '保存',
  'tags.modal.new':     '新建标签',
  'tags.modal.edit':    '编辑标签',

  // form fields
  'tags.field.displayName':            '显示名',
  'tags.field.displayNamePlaceholder': '小程序展示文案，例如「热门」「体育」',
  'tags.field.displayNameRequired':    '请输入显示名',
  'tags.field.slug':                   'Slug',
  'tags.field.slugPlaceholder':        '留空则按显示名自动生成（小写连字符）',
  'tags.field.slugHint':               '小程序内部 key，建议保持英文+连字符。创建后慎改，可能影响外部缓存。',
  'tags.field.sortOrder':              '排序（数字越小越靠前）',
  'tags.field.active':                 '上线（小程序可见）',
  'tags.field.pinned':                 '置顶（is_pinned）',

  // confirms
  'tags.confirm.delete':       '删除此标签？',
  'tags.confirm.deleteDesc':   '此操作不可撤销',
  'tags.cannotDelete':         '该标签仍被 {n} 个事件引用，请先解除关联再删除',

  // toggles
  'tags.toggle.on':  '开',
  'tags.toggle.off': '关',

  // toasts
  'tags.toast.created':       '已创建',
  'tags.toast.updated':       '已更新',
  'tags.toast.deleted':       '已删除',
  'tags.toast.saveFailed':    '保存失败',
  'tags.toast.deleteFailed':  '删除失败',
  'tags.toast.updateFailed':  '更新失败',

  // bulk page
  'tags.bulk.selectTag':         '选择标签',
  'tags.bulk.selectTagPlaceholder': '请先选择一个标签',
  'tags.bulk.attach':            '关联到所选',
  'tags.bulk.detach':            '从所选移除',
  'tags.bulk.selectedCount':     '已选 {n} 个事件',
  'tags.bulk.empty':             '选个标签开始',
  'tags.bulk.eventSearch':       '搜索事件',
  'tags.bulk.statusCol':         '关联状态',
  'tags.bulk.attached':          '已关联',
  'tags.bulk.notAttached':       '未关联',
  'tags.bulk.attachResult':      '新关联 {n} 个，已跳过已关联的 {skipped} 个',
  'tags.bulk.detachResult':      '已解除关联 {n} 个',
  'tags.bulk.nothingChanged':    '没有变化',

  // event drawer tag editor
  'tags.event.section':          '事件标签',
  'tags.event.placeholder':      '为该事件选择标签（可多选，留空表示无标签）',
  'tags.event.save':             '保存',
  'tags.event.saved':            '标签已更新',
};
