import { createStyles } from 'antd-style';
import React from 'react';

const useStyles = createStyles(({ token, css }) => ({
  footer: css`
    padding: 16px 24px;
    text-align: center;
    color: ${token.colorTextDescription};
    font-size: ${token.fontSizeSM}px;
    background: transparent;
  `,
}));

const Footer: React.FC = () => {
  const { styles } = useStyles();
  return (
    <div className={styles.footer}>
      PolyMind &copy; {new Date().getFullYear()}
    </div>
  );
};

export default Footer;
