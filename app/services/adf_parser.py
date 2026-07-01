class ADFParser:

    def parse(self, adf):

        if not adf:
            return ""

        text = []

        self._extract(adf, text)

        return "\n".join(text)

    def _extract(self, node, text):

        if isinstance(node, dict):

            node_type = node.get("type")

            if node_type == "text":
                text.append(node.get("text", ""))

            elif node_type == "paragraph":

                line = []

                for child in node.get("content", []):

                    if child.get("type") == "text":
                        line.append(child.get("text", ""))

                text.append("".join(line))

            elif node_type == "bulletList":

                for item in node.get("content", []):
                    self._extract(item, text)

            elif node_type == "listItem":

                bullet = []

                for child in node.get("content", []):
                    if child.get("type") == "paragraph":
                        paragraph = ""

                        for t in child.get("content", []):

                            if t.get("type") == "text":
                                paragraph += t.get("text", "")

                        bullet.append(paragraph)

                text.append("• " + " ".join(bullet))

            else:

                for child in node.get("content", []):

                    self._extract(child, text)

        elif isinstance(node, list):

            for item in node:

                self._extract(item, text)