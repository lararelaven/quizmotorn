import React from 'react';
import 'katex/dist/katex.min.css';
import Latex from 'react-latex-next';

const MathRenderer = ({ children, inline = false }) => {
    if (!children) return null;

    // Ensure input is a string
    const text = String(children);

    return (
        <span className="math-renderer">
            <Latex>{text}</Latex>
        </span>
    );
};

export default MathRenderer;
