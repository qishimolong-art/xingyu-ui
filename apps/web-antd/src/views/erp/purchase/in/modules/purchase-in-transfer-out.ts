export function getTransferOutSuccessMessage(result: {
  id?: number;
  ids?: number[];
}) {
  const documentCount = result.ids?.length || (result.id ? 1 : 0);
  return documentCount > 1
    ? `已按来源仓库生成 ${documentCount} 张调拨出库单`
    : '已生成调拨出库单';
}
