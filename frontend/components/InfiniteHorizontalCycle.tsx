import React, { useEffect, useMemo, useRef } from "react";
import { FlatList, StyleSheet, View } from "react-native";

type InfiniteHorizontalCycleProps<T> = {
  data: T[];
  itemWidth: number;
  itemGap?: number;
  sidePadding?: number;
  keyExtractor: (item: T, index: number) => string;
  renderItem: (item: T, index: number) => React.ReactElement;
  showsHorizontalScrollIndicator?: boolean;
};

export function InfiniteHorizontalCycle<T>({
  data,
  itemWidth,
  itemGap = 12,
  sidePadding = 16,
  keyExtractor,
  renderItem,
  showsHorizontalScrollIndicator = false,
}: InfiniteHorizontalCycleProps<T>) {
  const listRef = useRef<FlatList<T>>(null);
  const itemSpan = itemWidth + itemGap;

  const cycleData = useMemo(() => {
    if (data.length === 0) {
      return [];
    }
    return [...data, ...data, ...data];
  }, [data]);

  const centerOffset = useMemo(() => {
    if (data.length === 0) {
      return 0;
    }
    return itemSpan * data.length;
  }, [data.length, itemSpan]);

  useEffect(() => {
    if (data.length === 0) {
      return;
    }
    const task = setTimeout(() => {
      listRef.current?.scrollToOffset({
        offset: centerOffset,
        animated: false,
      });
    }, 0);

    return () => clearTimeout(task);
  }, [centerOffset, data.length]);

  const recenterIfNeeded = (offsetX: number) => {
    if (data.length === 0) {
      return;
    }
    const totalSpan = itemSpan * data.length;
    const minSafe = totalSpan * 0.5;
    const maxSafe = totalSpan * 1.5;

    if (offsetX < minSafe) {
      listRef.current?.scrollToOffset({
        offset: offsetX + totalSpan,
        animated: false,
      });
      return;
    }

    if (offsetX > maxSafe) {
      listRef.current?.scrollToOffset({
        offset: offsetX - totalSpan,
        animated: false,
      });
    }
  };

  return (
    <FlatList
      ref={listRef}
      horizontal
      nestedScrollEnabled
      directionalLockEnabled={false}
      data={cycleData}
      keyExtractor={(item, index) => {
        const baseIndex = data.length > 0 ? index % data.length : index;
        return `${keyExtractor(item, baseIndex)}-${index}`;
      }}
      renderItem={({ item, index }) => {
        const baseIndex = data.length > 0 ? index % data.length : index;
        return (
          <View style={[styles.itemWrap, { marginRight: itemGap }]}>
            {renderItem(item, baseIndex)}
          </View>
        );
      }}
      showsHorizontalScrollIndicator={showsHorizontalScrollIndicator}
      contentContainerStyle={{
        paddingLeft: sidePadding,
        paddingRight: Math.max(0, sidePadding - itemGap),
        alignItems: "flex-start",
      }}
      onMomentumScrollEnd={(event) => {
        recenterIfNeeded(event.nativeEvent.contentOffset.x);
      }}
      onScrollEndDrag={(event) => {
        recenterIfNeeded(event.nativeEvent.contentOffset.x);
      }}
      scrollEventThrottle={16}
      bounces
      initialNumToRender={6}
      maxToRenderPerBatch={8}
      windowSize={7}
      removeClippedSubviews
      getItemLayout={(_, index) => ({
        length: itemSpan,
        offset: itemSpan * index,
        index,
      })}
    />
  );
}

const styles = StyleSheet.create({
  itemWrap: {
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
});
