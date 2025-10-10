import { Box, Text } from "ink";
import { useTimelineStore } from "../../stores/timelineStore.js";

interface TimelinePanelProps {
  width: number;
  focused: boolean;
}

export function TimelinePanel({ width, focused }: TimelinePanelProps) {
  const { requests } = useTimelineStore();

  return (
    <Box
      flexDirection="column"
      width={width}
      borderStyle="single"
      borderColor={focused ? "cyan" : "gray"}
    >
      <Box paddingX={1} paddingY={0} justifyContent="space-between">
        <Text bold color={focused ? "cyan" : "gray"}>
          Timeline
        </Text>
        <Text dimColor>{requests.length}</Text>
      </Box>
      <Box flexDirection="column" paddingX={1} paddingTop={1}>
        {requests.length === 0 ? (
          <Text dimColor>No requests</Text>
        ) : (
          requests.slice(0, 10).map((req) => (
            <Box key={`${req.method}-${req.url}-${req.timestamp}`} gap={1}>
              <Text color="gray">○</Text>
              <Text color={getMethodColor(req.method)} bold>
                {req.method.padEnd(4)}
              </Text>
              <Text dimColor>{truncateUrl(req.url, 20)}</Text>
            </Box>
          ))
        )}
      </Box>
    </Box>
  );
}

function getMethodColor(method: string): string {
  switch (method.toUpperCase()) {
    case "GET":
      return "blue";
    case "POST":
      return "green";
    case "PUT":
      return "yellow";
    case "PATCH":
      return "magenta";
    case "DELETE":
      return "red";
    default:
      return "white";
  }
}

function truncateUrl(url: string, maxLength = 30): string {
  if (url.length <= maxLength) {
    return url;
  }
  return `${url.substring(0, maxLength - 3)}...`;
}
